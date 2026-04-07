import Foundation
import Alamofire

enum APIError: Error, LocalizedError {
    case invalidResponse
    case serverError(String)
    case unauthorized
    case notFound
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Invalid response from server."
        case .serverError(let message): message
        case .unauthorized: "You must be signed in."
        case .notFound: "The requested resource was not found."
        case .networkError(let error): error.localizedDescription
        }
    }
}

actor APIClient {
    static let shared = APIClient()

    private let session: Session
    let currentBaseURL: String

    init(baseURL: String = "https://josemadridsalsa.com/api") {
        self.currentBaseURL = baseURL

        let configuration = URLSessionConfiguration.default
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        configuration.httpCookieStorage = HTTPCookieStorage.shared

        self.session = Session(configuration: configuration)
    }

    func request<T: Decodable & Sendable>(
        _ endpoint: String,
        method: HTTPMethod = .get,
        parameters: Parameters? = nil
    ) async throws -> T {
        let url = "\(currentBaseURL)\(endpoint)"

        var headers: HTTPHeaders = [
            "Accept": "application/json",
        ]
        if method != .get {
            headers.add(name: "Content-Type", value: "application/json")
        }

        let encoding: ParameterEncoding = method == .get
            ? URLEncoding.default
            : JSONEncoding.default

        let response = await session.request(
            url,
            method: method,
            parameters: parameters,
            encoding: encoding,
            headers: headers
        )
        .validate()
        .serializingDecodable(T.self)
        .response

        switch response.result {
        case .success(let value):
            return value
        case .failure(let error):
            if let statusCode = response.response?.statusCode {
                switch statusCode {
                case 401: throw APIError.unauthorized
                case 404: throw APIError.notFound
                default:
                    if let data = response.data,
                       let body = try? JSONDecoder().decode([String: String].self, from: data),
                       let message = body["error"] {
                        throw APIError.serverError(message)
                    }
                    throw APIError.serverError("Server error (\(statusCode))")
                }
            }
            throw APIError.networkError(error)
        }
    }

    /// Sign in via NextAuth credentials provider (form-encoded).
    func signIn(email: String, password: String, csrfToken: String) async {
        let url = "\(currentBaseURL)/auth/callback/credentials"
        let params: [String: String] = [
            "email": email,
            "password": password,
            "csrfToken": csrfToken,
        ]
        _ = await session.request(url, method: .post, parameters: params,
            encoder: URLEncodedFormParameterEncoder.default)
            .serializingData().response
    }

    /// Sign out via NextAuth (form-encoded, not JSON).
    func signOut(csrfToken: String) async {
        let url = "\(currentBaseURL)/auth/signout"
        let params: [String: String] = ["csrfToken": csrfToken]
        _ = await session.request(url, method: .post, parameters: params,
            encoder: URLEncodedFormParameterEncoder.default)
            .serializingData().response
        clearCookies()
    }

    /// Clear all cookies for the base URL domain.
    func clearCookies() {
        guard let url = URL(string: currentBaseURL),
              let cookies = HTTPCookieStorage.shared.cookies(for: url) else { return }
        for cookie in cookies {
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }
    }
}

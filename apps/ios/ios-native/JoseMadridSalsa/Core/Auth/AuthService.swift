import Foundation

struct SessionUser: Codable, Sendable {
    let id: String
    let email: String
    let name: String?
    let role: UserRole
    let fundraiserId: String?
    let image: String?
}

struct AuthSession: Codable, Sendable {
    let user: SessionUser?
    let expires: String?
}

struct CSRFResponse: Codable, Sendable {
    let csrfToken: String
}

actor AuthService {
    static let shared = AuthService()

    private let client = APIClient.shared

    func fetchCSRFToken() async throws -> String {
        let response: CSRFResponse = try await client.request("/auth/csrf")
        return response.csrfToken
    }

    func signIn(email: String, password: String) async throws -> SessionUser {
        let csrfToken = try await fetchCSRFToken()
        await client.signIn(email: email, password: password, csrfToken: csrfToken)

        guard let session = try await fetchSession() else {
            throw AuthError.signInFailed
        }
        return session
    }

    func register(email: String, password: String, name: String?) async throws -> SessionUser {
        var params: [String: Any] = [
            "email": email,
            "password": password,
        ]
        if let name { params["name"] = name }

        let _: [String: Bool] = try await client.request(
            "/auth/register",
            method: .post,
            parameters: params
        )

        return try await signIn(email: email, password: password)
    }

    func fetchSession() async throws -> SessionUser? {
        let session: AuthSession = try await client.request("/auth/session")
        return session.user
    }

    func signOut() async {
        do {
            let csrfToken = try await fetchCSRFToken()
            await client.signOut(csrfToken: csrfToken)
        } catch {
            await client.clearCookies()
        }
        KeychainManager.deleteAll()
    }

    func forgotPassword(email: String) async throws {
        let _: [String: Bool] = try await client.request(
            "/auth/forgot-password",
            method: .post,
            parameters: ["email": email]
        )
    }

    // MARK: - OAuth URLs

    func oauthURL(provider: OAuthProvider) async throws -> URL {
        let csrfToken = try await fetchCSRFToken()
        let baseURL = await client.currentBaseURL
        let callbackURL = "\(baseURL)/api/auth/callback/\(provider.rawValue)"

        var components = URLComponents(string: "\(baseURL)/api/auth/signin/\(provider.rawValue)")!
        components.queryItems = [
            URLQueryItem(name: "csrfToken", value: csrfToken),
            URLQueryItem(name: "callbackUrl", value: callbackURL),
        ]

        guard let url = components.url else {
            throw AuthError.invalidURL
        }
        return url
    }

    func googleOAuthURL() async throws -> URL {
        try await oauthURL(provider: .google)
    }

    // MARK: - Password Reset

    func verifyResetToken(_ token: String) async throws -> Bool {
        struct TokenResponse: Codable, Sendable {
            let valid: Bool
        }
        let response: TokenResponse = try await client.request(
            "/auth/verify-reset-token",
            parameters: ["token": token]
        )
        return response.valid
    }

    func resetPassword(token: String, password: String) async throws {
        let _: [String: Bool] = try await client.request(
            "/auth/reset-password",
            method: .post,
            parameters: ["token": token, "password": password]
        )
    }
}

enum OAuthProvider: String, CaseIterable, Sendable {
    case google
    case github
    case facebook
    case apple
}

enum AuthError: Error, Equatable, LocalizedError {
    case signInFailed
    case invalidCredentials
    case accountExists
    case invalidURL
    case oauthCancelled
    case invalidToken
    case invalidEmail

    var errorDescription: String? {
        switch self {
        case .signInFailed: "Sign in failed. Please try again."
        case .invalidCredentials: "Invalid email or password."
        case .accountExists: "An account with this email already exists."
        case .invalidURL: "Could not build authentication URL."
        case .oauthCancelled: "Sign in was cancelled."
        case .invalidToken: "This reset link is invalid or has expired."
        case .invalidEmail: "Please enter a valid email address."
        }
    }
}

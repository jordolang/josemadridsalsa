import Foundation
import AuthenticationServices

@MainActor
final class AuthViewModel: ObservableObject {
    @Published private(set) var currentUser: SessionUser?
    @Published private(set) var isLoading = false
    @Published private(set) var isCheckingSession = true
    @Published var errorMessage: String?

    @Published var email = ""
    @Published var password = ""

    @Published var registerName = ""
    @Published var registerEmail = ""
    @Published var registerPassword = ""
    @Published var registerConfirmPassword = ""

    private let authService = AuthService.shared

    var isAuthenticated: Bool { currentUser != nil }

    // MARK: - Session Management

    func checkSession() async {
        isCheckingSession = true
        do {
            currentUser = try await authService.fetchSession()
        } catch {
            currentUser = nil
        }
        isCheckingSession = false
    }

    // MARK: - Credentials Sign In

    func signIn() async {
        guard validateSignInForm() else { return }
        isLoading = true
        errorMessage = nil

        do {
            currentUser = try await authService.signIn(
                email: email.lowercased().trimmingCharacters(in: .whitespaces),
                password: password
            )
            clearForms()
        } catch let error as APIError {
            if case .unauthorized = error {
                errorMessage = AuthError.invalidCredentials.localizedDescription
            } else {
                errorMessage = error.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Registration

    func register() async {
        guard validateRegisterForm() else { return }
        isLoading = true
        errorMessage = nil

        do {
            currentUser = try await authService.register(
                email: registerEmail.lowercased().trimmingCharacters(in: .whitespaces),
                password: registerPassword,
                name: registerName.isEmpty ? nil : registerName
            )
            clearForms()
        } catch let error as APIError {
            if case .serverError(let message) = error {
                errorMessage = message
            } else {
                errorMessage = error.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Google OAuth

    func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil

        do {
            let url = try await authService.googleOAuthURL()
            let callbackURL = try await performWebAuth(url: url)
            await handleOAuthCallback(callbackURL)
        } catch let error as AuthError {
            if error != .oauthCancelled {
                errorMessage = error.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func performWebAuth(url: URL) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url,
                callback: .customScheme("josemadridsalsa")
            ) { callbackURL, error in
                if let error {
                    if (error as NSError).code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                        continuation.resume(throwing: AuthError.oauthCancelled)
                    } else {
                        continuation.resume(throwing: error)
                    }
                    return
                }
                guard let callbackURL else {
                    continuation.resume(throwing: AuthError.signInFailed)
                    return
                }
                continuation.resume(returning: callbackURL)
            }
            // TODO: Test cookie propagation on physical device — simulator may not
            // forward HTTPCookieStorage cookies into ASWebAuthenticationSession.
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    private func handleOAuthCallback(_ url: URL) async {
        do {
            currentUser = try await authService.fetchSession()
            if currentUser == nil {
                errorMessage = AuthError.signInFailed.localizedDescription
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Sign Out

    func signOut() async {
        await authService.signOut()
        currentUser = nil
    }

    // MARK: - Password Reset

    func forgotPassword() async {
        let trimmedEmail = email.lowercased().trimmingCharacters(in: .whitespaces)
        guard !trimmedEmail.isEmpty else {
            errorMessage = "Please enter your email address."
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            try await authService.forgotPassword(email: trimmedEmail)
        } catch {
            // Don't reveal whether the email exists
        }

        isLoading = false
    }

    // MARK: - Validation

    private func validateSignInForm() -> Bool {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        if trimmedEmail.isEmpty {
            errorMessage = "Please enter your email address."
            return false
        }
        if password.isEmpty {
            errorMessage = "Please enter your password."
            return false
        }
        return true
    }

    private func validateRegisterForm() -> Bool {
        if registerEmail.trimmingCharacters(in: .whitespaces).isEmpty {
            errorMessage = "Please enter your email address."
            return false
        }
        if registerPassword.count < 8 {
            errorMessage = "Password must be at least 8 characters."
            return false
        }
        if registerPassword != registerConfirmPassword {
            errorMessage = "Passwords do not match."
            return false
        }
        return true
    }

    private func clearForms() {
        email = ""
        password = ""
        registerName = ""
        registerEmail = ""
        registerPassword = ""
        registerConfirmPassword = ""
    }
}

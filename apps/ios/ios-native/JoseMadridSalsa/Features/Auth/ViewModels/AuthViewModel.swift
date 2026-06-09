import Foundation
import AuthenticationServices

@MainActor
final class AuthViewModel: ObservableObject {
    @Published private(set) var currentUser: SessionUser?
    @Published private(set) var isLoading = false
    @Published private(set) var isCheckingSession = true
    @Published var errorMessage: String?
    @Published var successMessage: String?

    @Published var email = ""
    @Published var password = ""

    @Published var registerName = ""
    @Published var registerEmail = ""
    @Published var registerPassword = ""
    @Published var registerConfirmPassword = ""

    @Published var resetToken = ""
    @Published var newPassword = ""
    @Published var confirmNewPassword = ""

    private let authService = AuthService.shared

    var isAuthenticated: Bool { currentUser != nil }

    private static let emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

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

    // MARK: - OAuth Sign In

    func signInWithOAuth(provider: OAuthProvider) async {
        if provider == .apple {
            await signInWithAppleNative()
            return
        }

        isLoading = true
        errorMessage = nil

        do {
            let url = try await authService.oauthURL(provider: provider)
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

    func signInWithGoogle() async {
        await signInWithOAuth(provider: .google)
    }

    func signInWithGitHub() async {
        await signInWithOAuth(provider: .github)
    }

    func signInWithFacebook() async {
        await signInWithOAuth(provider: .facebook)
    }

    // MARK: - Apple Sign In (Native)

    func signInWithAppleNative() async {
        isLoading = true
        errorMessage = nil

        do {
            let url = try await authService.oauthURL(provider: .apple)
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

    // MARK: - Forgot Password

    func forgotPassword() async {
        let trimmedEmail = email.lowercased().trimmingCharacters(in: .whitespaces)
        guard !trimmedEmail.isEmpty else {
            errorMessage = "Please enter your email address."
            return
        }
        guard isValidEmail(trimmedEmail) else {
            errorMessage = AuthError.invalidEmail.localizedDescription
            return
        }

        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            try await authService.forgotPassword(email: trimmedEmail)
        } catch {
            // Don't reveal whether the email exists
        }

        successMessage = "If an account exists with that email, you will receive a reset link."
        isLoading = false
    }

    // MARK: - Reset Password

    func verifyResetToken() async -> Bool {
        guard !resetToken.isEmpty else {
            errorMessage = AuthError.invalidToken.localizedDescription
            return false
        }

        isLoading = true
        errorMessage = nil

        do {
            let valid = try await authService.verifyResetToken(resetToken)
            if !valid {
                errorMessage = AuthError.invalidToken.localizedDescription
            }
            isLoading = false
            return valid
        } catch {
            errorMessage = AuthError.invalidToken.localizedDescription
            isLoading = false
            return false
        }
    }

    func resetPassword() async {
        guard validateResetPasswordForm() else { return }
        isLoading = true
        errorMessage = nil
        successMessage = nil

        do {
            try await authService.resetPassword(token: resetToken, password: newPassword)
            successMessage = "Password reset successfully. You can now sign in."
            resetToken = ""
            newPassword = ""
            confirmNewPassword = ""
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Validation

    private func isValidEmail(_ email: String) -> Bool {
        email.wholeMatch(of: Self.emailRegex) != nil
    }

    private func validateSignInForm() -> Bool {
        let trimmedEmail = email.trimmingCharacters(in: .whitespaces)
        if trimmedEmail.isEmpty {
            errorMessage = "Please enter your email address."
            return false
        }
        if !isValidEmail(trimmedEmail) {
            errorMessage = AuthError.invalidEmail.localizedDescription
            return false
        }
        if password.isEmpty {
            errorMessage = "Please enter your password."
            return false
        }
        return true
    }

    private func validateRegisterForm() -> Bool {
        let trimmedEmail = registerEmail.trimmingCharacters(in: .whitespaces)
        if trimmedEmail.isEmpty {
            errorMessage = "Please enter your email address."
            return false
        }
        if !isValidEmail(trimmedEmail) {
            errorMessage = AuthError.invalidEmail.localizedDescription
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

    private func validateResetPasswordForm() -> Bool {
        if resetToken.isEmpty {
            errorMessage = AuthError.invalidToken.localizedDescription
            return false
        }
        if newPassword.count < 8 {
            errorMessage = "Password must be at least 8 characters."
            return false
        }
        if newPassword != confirmNewPassword {
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
        resetToken = ""
        newPassword = ""
        confirmNewPassword = ""
        successMessage = nil
    }
}

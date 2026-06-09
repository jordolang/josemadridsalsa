import AuthenticationServices
import SwiftUI

struct SignUpView: View {
    @ObservedObject var viewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                headerSection
                cardContent
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 40)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 8) {
            Text("Join Jose Madrid Salsa")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.primary)

            Text("Create an account to save your details and keep track of your orders.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Card

    private var cardContent: some View {
        VStack(spacing: 20) {
            socialLoginButtons
            divider
            registrationForm
            errorBanner
            registerButton
            footerLinks
        }
        .padding(24)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
    }

    // MARK: - Social Login

    private var socialLoginButtons: some View {
        VStack(spacing: 12) {
            SocialLoginButton(
                provider: .google,
                isLoading: viewModel.isLoading
            ) {
                Task { await viewModel.signInWithGoogle() }
            }

            SocialLoginButton(
                provider: .gitHub,
                isLoading: viewModel.isLoading
            ) {
                Task { await viewModel.signInWithGitHub() }
            }

            SocialLoginButton(
                provider: .facebook,
                isLoading: viewModel.isLoading
            ) {
                Task { await viewModel.signInWithFacebook() }
            }

            SignInWithAppleButton(.signUp) { request in
                request.requestedScopes = [.email, .fullName]
            } onCompletion: { result in
                Task { await viewModel.signInWithOAuth(provider: .apple) }
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .disabled(viewModel.isLoading)
        }
    }

    private var divider: some View {
        HStack {
            Rectangle()
                .frame(height: 1)
                .foregroundStyle(Color(.separator))
            Text("Or continue with email")
                .font(.caption)
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
                .fixedSize()
            Rectangle()
                .frame(height: 1)
                .foregroundStyle(Color(.separator))
        }
    }

    // MARK: - Registration Form

    private var registrationForm: some View {
        VStack(spacing: 16) {
            AuthTextField(
                label: "Name",
                placeholder: "Jane Doe",
                text: $viewModel.registerName,
                contentType: .name,
                capitalization: .words
            )

            AuthTextField(
                label: "Email",
                placeholder: "you@example.com",
                text: $viewModel.registerEmail,
                contentType: .emailAddress,
                keyboardType: .emailAddress
            )

            AuthSecureField(
                label: "Password",
                placeholder: "At least 8 characters",
                text: $viewModel.registerPassword,
                contentType: .newPassword
            )

            AuthSecureField(
                label: "Confirm password",
                placeholder: "Re-enter your password",
                text: $viewModel.registerConfirmPassword,
                contentType: .newPassword
            )
        }
    }

    // MARK: - Error

    @ViewBuilder
    private var errorBanner: some View {
        if let message = viewModel.errorMessage {
            Text(message)
                .font(.footnote)
                .foregroundStyle(.white)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.85))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Register Button

    private var registerButton: some View {
        Button {
            Task {
                await viewModel.register()
                if viewModel.isAuthenticated {
                    dismiss()
                }
            }
        } label: {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Create account")
                }
            }
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color.salsaRed)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .disabled(viewModel.isLoading)
    }

    // MARK: - Footer

    private var footerLinks: some View {
        VStack(spacing: 8) {
            Button {
                dismiss()
            } label: {
                Text("Already have an account? ")
                    .foregroundStyle(.secondary) +
                Text("Sign in")
                    .foregroundStyle(Color.salsaRed)
            }
            .font(.footnote)

            Text("Passwords must be at least 8 characters. By creating an account you agree to our terms of service and privacy policy.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Reusable Field Components

struct AuthTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var contentType: UITextContentType?
    var keyboardType: UIKeyboardType = .default
    var capitalization: TextInputAutocapitalization = .never

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline.weight(.medium))
            TextField(placeholder, text: $text)
                .textContentType(contentType)
                .keyboardType(keyboardType)
                .autocorrectionDisabled()
                .textInputAutocapitalization(capitalization)
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}

struct AuthSecureField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var contentType: UITextContentType?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.subheadline.weight(.medium))
            SecureField(placeholder, text: $text)
                .textContentType(contentType)
                .padding(12)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }
}

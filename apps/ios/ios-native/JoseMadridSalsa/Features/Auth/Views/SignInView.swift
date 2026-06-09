import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var showForgotPassword = false
    @State private var showSignUp = false

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
        .sheet(isPresented: $showSignUp) {
            NavigationStack {
                SignUpView(viewModel: viewModel)
            }
        }
        .sheet(isPresented: $showForgotPassword) {
            NavigationStack {
                ForgotPasswordView(viewModel: viewModel)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 8) {
            Text("Welcome back")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.primary)

            Text("Sign in to manage your orders and explore the latest Jose Madrid Salsa releases.")
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
            emailForm
            errorBanner
            signInButton
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

            SignInWithAppleButton(.signIn) { request in
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

    // MARK: - Email Form

    private var emailForm: some View {
        VStack(spacing: 16) {
            AuthTextField(
                label: "Email",
                placeholder: "you@example.com",
                text: $viewModel.email,
                contentType: .emailAddress,
                keyboardType: .emailAddress
            )

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Password")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    Button("Forgot password?") {
                        showForgotPassword = true
                    }
                    .font(.caption)
                    .foregroundStyle(Color.salsaRed)
                }
                SecureField("••••••••", text: $viewModel.password)
                    .textContentType(.password)
                    .padding(12)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
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

    // MARK: - Sign In Button

    private var signInButton: some View {
        Button {
            Task { await viewModel.signIn() }
        } label: {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Sign in")
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
                showSignUp = true
            } label: {
                Text("Need an account? ")
                    .foregroundStyle(.secondary) +
                Text("Create one")
                    .foregroundStyle(Color.salsaRed)
            }
            .font(.footnote)

            Text("By signing in you agree to our terms of service and privacy policy.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Social Login Components

enum SocialProvider {
    case google, gitHub, facebook

    var title: String {
        switch self {
        case .google: "Continue with Google"
        case .gitHub: "Continue with GitHub"
        case .facebook: "Continue with Facebook"
        }
    }

    var iconName: String {
        switch self {
        case .google: "g.circle.fill"
        case .gitHub: "chevron.left.forwardslash.chevron.right"
        case .facebook: "f.circle.fill"
        }
    }
}

struct SocialLoginButton: View {
    let provider: SocialProvider
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: provider.iconName)
                    .font(.body)
                Text(provider.title)
                    .font(.subheadline.weight(.medium))
            }
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color(.separator), lineWidth: 1)
            )
        }
        .disabled(isLoading)
    }
}

// MARK: - Brand Color

extension Color {
    static let salsaRed = Color(red: 0.8, green: 0.15, blue: 0.15)
}

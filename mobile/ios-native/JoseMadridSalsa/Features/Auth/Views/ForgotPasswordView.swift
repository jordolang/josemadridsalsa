import SwiftUI

struct ForgotPasswordView: View {
    @ObservedObject var viewModel: AuthViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var submitted = false

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
            Text("Reset your password")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.primary)

            Text("Enter the email address associated with your account and we'll send you instructions to reset your password.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Card

    private var cardContent: some View {
        VStack(spacing: 20) {
            if submitted {
                successMessage
            } else {
                emailField
                errorBanner
                submitButton
            }
            backToSignIn
        }
        .padding(24)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
    }

    // MARK: - Email Field

    private var emailField: some View {
        AuthTextField(
            label: "Email",
            placeholder: "you@example.com",
            text: $viewModel.email,
            contentType: .emailAddress,
            keyboardType: .emailAddress
        )
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

    // MARK: - Submit Button

    private var submitButton: some View {
        Button {
            Task {
                await viewModel.forgotPassword()
                if viewModel.errorMessage == nil {
                    submitted = true
                }
            }
        } label: {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Send reset instructions")
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

    // MARK: - Success

    private var successMessage: some View {
        VStack(spacing: 12) {
            Image(systemName: "envelope.badge.shield.half.filled")
                .font(.system(size: 40))
                .foregroundStyle(Color.salsaRed)

            Text("Check your email")
                .font(.headline)

            Text("If an account exists for that email, we've sent password reset instructions. Check your inbox and spam folder.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Back Link

    private var backToSignIn: some View {
        Button {
            dismiss()
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "arrow.left")
                    .font(.caption)
                Text("Back to sign in")
            }
            .font(.footnote)
            .foregroundStyle(Color.salsaRed)
        }
    }
}

import SwiftUI

struct ResetPasswordView: View {
    @ObservedObject var viewModel: AuthViewModel
    let token: String

    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var localError: String?
    @State private var succeeded = false

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
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 8) {
            Text("Set new password")
                .font(.system(size: 28, weight: .bold, design: .serif))
                .foregroundStyle(.primary)

            Text("Choose a strong password for your account.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 24)
    }

    // MARK: - Card

    private var cardContent: some View {
        VStack(spacing: 20) {
            if succeeded {
                successMessage
            } else {
                passwordFields
                errorBanner
                submitButton
            }
        }
        .padding(24)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
    }

    // MARK: - Password Fields

    private var passwordFields: some View {
        VStack(spacing: 16) {
            AuthSecureField(
                label: "New password",
                placeholder: "At least 8 characters",
                text: $newPassword,
                contentType: .newPassword
            )

            AuthSecureField(
                label: "Confirm new password",
                placeholder: "Re-enter your password",
                text: $confirmPassword,
                contentType: .newPassword
            )
        }
    }

    // MARK: - Error

    @ViewBuilder
    private var errorBanner: some View {
        let message = localError ?? viewModel.errorMessage
        if let message {
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
            submitReset()
        } label: {
            Group {
                if viewModel.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("Reset password")
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
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 40))
                .foregroundStyle(.green)

            Text("Password updated")
                .font(.headline)

            Text("Your password has been reset successfully. You can now sign in with your new password.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 8)
    }

    // MARK: - Logic

    private func submitReset() {
        localError = nil

        guard newPassword.count >= 8 else {
            localError = "Password must be at least 8 characters."
            return
        }
        guard newPassword == confirmPassword else {
            localError = "Passwords do not match."
            return
        }

        viewModel.resetToken = token
        viewModel.newPassword = newPassword
        viewModel.confirmNewPassword = confirmPassword

        Task {
            await viewModel.resetPassword()
            if viewModel.errorMessage == nil {
                succeeded = true
            }
        }
    }
}

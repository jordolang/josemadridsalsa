import Foundation

@MainActor
final class AccountViewModel: ObservableObject {
    @Published private(set) var profile: User?
    @Published private(set) var addresses: [Address] = []
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage: String?

    private let accountService = AccountService()

    func loadProfile() async {
        isLoading = true
        errorMessage = nil

        do {
            profile = try await accountService.fetchProfile()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    func clear() {
        profile = nil
        addresses = []
    }
}

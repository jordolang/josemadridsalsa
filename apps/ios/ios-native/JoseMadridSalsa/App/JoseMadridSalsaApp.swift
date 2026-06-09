import SwiftUI

@main
struct JoseMadridSalsaApp: App {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var cartViewModel = CartViewModel()
    @StateObject private var accountViewModel = AccountViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authViewModel)
                .environmentObject(cartViewModel)
                .environmentObject(accountViewModel)
                .task {
                    await authViewModel.checkSession()
                }
        }
    }
}

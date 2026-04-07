import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authViewModel: AuthViewModel

    var body: some View {
        Group {
            if authViewModel.isCheckingSession {
                ProgressView("Loading...")
            } else {
                TabView {
                    NavigationStack {
                        Text("Shop")
                    }
                    .tabItem {
                        Label("Shop", systemImage: "storefront")
                    }

                    NavigationStack {
                        Text("Cart")
                    }
                    .tabItem {
                        Label("Cart", systemImage: "cart")
                    }

                    NavigationStack {
                        Text("Orders")
                    }
                    .tabItem {
                        Label("Orders", systemImage: "shippingbox")
                    }

                    NavigationStack {
                        Text("Account")
                    }
                    .tabItem {
                        Label("Account", systemImage: "person.circle")
                    }
                }
            }
        }
    }
}

// Jose Madrid Kiosk (iPad): full-screen /kiosk page, receipt printing, barcode scanner pass-through,
// and card payments on a Bluetooth Square Reader (Kiosk/Payments/SquareCardReader.swift).
//
// Locking the iPad to this app: Settings > Accessibility > Guided Access > On, set a passcode,
// then open the kiosk and triple-click the top (or Home) button > Start. Turn Auto-Lock off in
// Display & Brightness as well (the app also keeps the screen awake while it runs).
// Staff menu: hold the top-right corner for 3 seconds, then enter the staff PIN.

import SwiftUI

/// Square's Mobile Payments SDK has to start in didFinishLaunching, before anything else uses it.
final class KioskAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        SquareCardReader.start(launchOptions: launchOptions)
        return true
    }
}

@main
struct KioskApp: App {
    @UIApplicationDelegateAdaptor(KioskAppDelegate.self) private var appDelegate
    @StateObject private var settings = KioskSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .onAppear {
                    UIApplication.shared.isIdleTimerDisabled = true
                    PrinterHub.shared.apply(settings.printer)
                }
                .onChange(of: settings.printer) { PrinterHub.shared.apply($0) }
        }
    }
}

private struct RootView: View {
    @EnvironmentObject private var settings: KioskSettings
    @State private var sheet: Sheet?
    @State private var reloadToken = 0

    enum Sheet: Identifiable {
        case setup, pin, menu
        var id: Self { self }
    }

    var body: some View {
        WebViewHost(reloadToken: reloadToken) { sheet = .pin }
            .ignoresSafeArea()
            .statusBarHidden(true)
            .persistentSystemOverlays(.hidden)
            .onAppear {
                if settings.isConfigured { Task { await SquareCardReader.shared.signIn() } } else { sheet = .setup }
            }
            .sheet(item: $sheet) { which in
                switch which {
                case .setup:
                    SetupView {
                        sheet = nil
                        reloadToken += 1
                        // The device token may have changed, and with it the Square account.
                        Task { await SquareCardReader.shared.signIn() }
                    }
                        .interactiveDismissDisabled(!settings.isConfigured)
                case .pin:
                    PinView(expected: settings.staffPIN) { ok in sheet = ok ? .menu : nil }
                case .menu:
                    StaffMenu(
                        reload: { sheet = nil; reloadToken += 1 },
                        settings: { sheet = .setup },
                        close: { sheet = nil }
                    )
                }
            }
    }
}

/// Hosts the UIKit web view controller and reloads it when `reloadToken` changes.
private struct WebViewHost: UIViewControllerRepresentable {
    let reloadToken: Int
    let onStaffGesture: () -> Void

    func makeUIViewController(context: Context) -> KioskWebViewController {
        let vc = KioskWebViewController()
        vc.onStaffGesture = onStaffGesture
        context.coordinator.lastToken = reloadToken
        return vc
    }

    func updateUIViewController(_ vc: KioskWebViewController, context: Context) {
        vc.onStaffGesture = onStaffGesture
        if context.coordinator.lastToken != reloadToken {
            context.coordinator.lastToken = reloadToken
            vc.reload()
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator { var lastToken = 0 }
}

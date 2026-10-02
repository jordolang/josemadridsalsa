import Foundation
import Network

/// A Wi-Fi or Ethernet ESC/POS printer listening for raw jobs (port 9100 by convention).
@MainActor
final class NetworkPrinter: ReceiptPrinter {
    private let host: String
    private let port: UInt16
    private var probeTimer: Timer?

    private(set) var connected = false { didSet { if connected != oldValue { onStatusChange?() } } }
    var onStatusChange: (() -> Void)?
    var displayName: String { "\(host):\(port)" }

    init(host: String, port: UInt16) {
        self.host = host
        self.port = port
    }

    func start() {
        probe()
        probeTimer = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.probe() }
        }
    }

    func stop() {
        probeTimer?.invalidate()
        probeTimer = nil
    }

    func print(_ lines: [PrintLine]) async throws {
        do {
            try await send(EscPos.encode(lines))
            connected = true
        } catch {
            connected = false
            throw error
        }
    }

    private func probe() {
        Task {
            do {
                try await send(nil)
                connected = true
            } catch {
                connected = false
            }
        }
    }

    /// Opens a TCP connection, writes `data` if any, and closes. `nil` just checks reachability.
    private func send(_ data: Data?) async throws {
        guard let nwPort = NWEndpoint.Port(rawValue: port) else { throw PrinterError("Invalid port \(port)") }
        let connection = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: .tcp)
        defer { connection.cancel() }

        let host = host, port = port
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            let once = ResumeOnce(cont)
            let finish: @Sendable (Error?) -> Void = { once.resume($0) }
            connection.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    guard let data else { return finish(nil) }
                    connection.send(content: data, contentContext: .finalMessage, isComplete: true, completion: .contentProcessed { error in
                        finish(error)
                    })
                case let .failed(error):
                    finish(error)
                case let .waiting(error):
                    finish(error)
                default:
                    break
                }
            }
            connection.start(queue: .main)
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                finish(PrinterError("Printer at \(host):\(port) did not answer"))
            }
        }
    }
}

/// Resumes a continuation exactly once, whichever callback (ready, failure, timeout) fires first.
final class ResumeOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<Void, Error>?

    init(_ continuation: CheckedContinuation<Void, Error>) { self.continuation = continuation }

    func resume(_ error: Error?) {
        lock.lock()
        let c = continuation
        continuation = nil
        lock.unlock()
        if let error { c?.resume(throwing: error) } else { c?.resume() }
    }
}

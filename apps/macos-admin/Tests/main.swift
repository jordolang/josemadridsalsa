import Foundation

assert(
  AdminEndpoint.validated("https://www.josemadrid.net")?.absoluteString ==
    "https://www.josemadrid.net/admin"
)
assert(
  AdminEndpoint.validated("http://localhost:3000")?.absoluteString ==
    "http://localhost:3000/admin"
)
assert(AdminEndpoint.validated("http://example.com/admin") == nil)
assert(AdminEndpoint.validated("javascript:alert(1)") == nil)
print("AdminEndpoint checks passed")

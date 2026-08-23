// swift-tools-version: 5.10

import PackageDescription

let package = Package(
  name: "JoseMadridAdmin",
  platforms: [.macOS(.v14)],
  products: [
    .executable(name: "JoseMadridAdmin", targets: ["JoseMadridAdmin"]),
  ],
  targets: [
    .executableTarget(name: "JoseMadridAdmin"),
  ]
)

// swift-tools-version: 5.10

import PackageDescription

let package = Package(
    name: "JoseMadridSalsa",
    platforms: [
        .iOS(.v17),
    ],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", from: "5.9.0"),
        .package(url: "https://github.com/onevcat/Kingfisher.git", from: "8.0.0"),
        .package(url: "https://github.com/stripe/stripe-ios.git", from: "24.0.0"),
    ],
    targets: [
        .executableTarget(
            name: "JoseMadridSalsa",
            dependencies: [
                "Alamofire",
                "Kingfisher",
                .product(name: "Stripe", package: "stripe-ios"),
            ],
            path: "JoseMadridSalsa"
        ),
    ]
)

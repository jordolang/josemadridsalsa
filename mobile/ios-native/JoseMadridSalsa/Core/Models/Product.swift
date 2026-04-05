import Foundation

enum HeatLevel: String, Codable, Sendable, CaseIterable {
    case mild = "MILD"
    case medium = "MEDIUM"
    case hot = "HOT"
    case extraHot = "EXTRA_HOT"
    case fruit = "FRUIT"
}

enum StockStatus: Sendable {
    case inStock
    case lowStock(Int)
    case outOfStock
}

struct Product: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let price: Double
    let compareAtPrice: Double?
    let featuredImage: String?
    let images: [String]
    let heatLevel: HeatLevel?
    let sku: String?
    let inventory: Int
    let isFeatured: Bool
    let ingredients: [String]
    let searchKeywords: [String]
    let tags: [String]?
    let nutritionalInfo: NutritionalInfo?

    var stockStatus: StockStatus {
        if inventory <= 0 { return .outOfStock }
        if inventory < 10 { return .lowStock(inventory) }
        return .inStock
    }

    var isOnSale: Bool {
        guard let compareAt = compareAtPrice else { return false }
        return compareAt > price
    }
}

struct NutritionalInfo: Codable, Hashable, Sendable {
    // Serving
    let servingSize: String?
    let servingsPerContainer: Int?

    // Calories
    let calories: Int?
    let caloriesFromFat: Int?

    // Fats
    let totalFatG: Double?
    let totalFatDV: Int?
    let saturatedFatG: Double?
    let saturatedFatDV: Int?
    let transFatG: Double?

    // Cholesterol
    let cholesterolMg: Double?
    let cholesterolDV: Int?

    // Sodium
    let sodiumMg: Double?
    let sodiumDV: Int?

    // Carbohydrates
    let totalCarbG: Double?
    let totalCarbDV: Int?
    let dietaryFiberG: Double?
    let dietaryFiberDV: Int?
    let sugarsG: Double?

    // Protein
    let proteinG: Double?

    // Vitamins & Minerals (% Daily Value)
    let vitaminADV: Int?
    let vitaminCDV: Int?
    let calciumDV: Int?
    let ironDV: Int?

    // Allergens
    let allergens: String?
}

struct ProductVariant: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let sku: String?
    let price: Double
    let inventory: Int
}

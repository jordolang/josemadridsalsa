import { ChatDomain } from '@prisma/client'

const domainKeywords: Record<ChatDomain, string[]> = {
  ORDERS: ['order', 'purchase', 'bought', 'ordered', 'tracking', 'delivery', 'shipment'],
  SHIPPING: ['shipping', 'delivery', 'tracking', 'package', 'shipped', 'carrier', 'fedex', 'ups', 'usps'],
  PAYMENT: ['payment', 'paid', 'charge', 'refund', 'credit card', 'billing'],
  STRIPE: ['stripe', 'transaction', 'charge failed', 'payment failed'],
  ACCOUNTS: ['account', 'login', 'password', 'sign in', 'register', 'profile'],
  PRODUCTS: ['product', 'salsa', 'flavor', 'ingredient', 'spicy', 'mild', 'hot'],
  GIFT_CERTIFICATES: ['gift certificate', 'gift card', 'balance', 'redeem'],
  FUNDRAISING: ['fundraiser', 'fundraising', 'school', 'organization', 'commission'],
  LOCATIONS: ['location', 'store', 'where to buy', 'near me', 'retailer'],
  DOCUMENTATION: ['help', 'how to', 'guide', 'tutorial', 'documentation'],
  GENERAL: [],
}

export function classifyQueryDomain(query: string): ChatDomain {
  const lowerQuery = query.toLowerCase()
  const scores: Partial<Record<ChatDomain, number>> = {}

  for (const [domain, keywords] of Object.entries(domainKeywords)) {
    let score = 0
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        score++
      }
    }
    if (score > 0) {
      scores[domain as ChatDomain] = score
    }
  }

  if (Object.keys(scores).length === 0) {
    return 'GENERAL'
  }

  const sortedDomains = Object.entries(scores).sort(([, a], [, b]) => (b || 0) - (a || 0))
  return sortedDomains[0][0] as ChatDomain
}

export function getDomainSystemPrompt(domain: ChatDomain): string {
  const prompts: Record<ChatDomain, string> = {
    ORDERS: 'You are a customer support assistant specializing in order management. Help customers track orders, understand order status, and resolve order-related issues.',
    SHIPPING: 'You are a shipping specialist. Help customers with delivery information, tracking, and shipping-related questions.',
    PAYMENT: 'You are a payment support specialist. Help customers with billing questions, payment methods, and refund requests.',
    STRIPE: 'You are a payment processing expert. Help troubleshoot payment failures and transaction issues.',
    ACCOUNTS: 'You are an account management assistant. Help customers with login, registration, and account-related questions.',
    PRODUCTS: 'You are a product expert for Jose Madrid Salsa. Help customers learn about our products, ingredients, and recommendations.',
    GIFT_CERTIFICATES: 'You are a gift certificate specialist. Help customers check balances, redeem certificates, and purchase new ones.',
    FUNDRAISING: 'You are a fundraising program coordinator. Help organizations understand and set up fundraising programs.',
    LOCATIONS: 'You are a retail location specialist. Help customers find stores near them that carry Jose Madrid Salsa products.',
    DOCUMENTATION: 'You are a helpful documentation assistant. Guide customers to relevant help articles and tutorials.',
    GENERAL: 'You are a helpful customer service assistant for Jose Madrid Salsa. Answer general questions about the company and products.',
  }

  return prompts[domain]
}

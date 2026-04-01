import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getRegisteredProviders } from '@/lib/payments'
import { METHOD_PROVIDER_MAP } from '@/lib/payments/registry'

export async function GET() {
  try {
    // Get provider configs from DB
    const providerConfigs = await prisma.paymentProviderConfig.findMany({
      where: { isActive: true },
      select: {
        provider: true,
        supportedMethods: true,
        testMode: true,
      },
    })

    const registeredProviders = getRegisteredProviders()

    // Build the list of enabled payment methods
    // If no DB configs exist, fall back to the registered providers' default methods
    if (providerConfigs.length === 0) {
      // Default: all methods from registered providers
      const methods = Object.entries(METHOD_PROVIDER_MAP)
        .filter(([, provider]) => registeredProviders.includes(provider))
        .map(([method, provider]) => ({
          method,
          provider,
          enabled: true,
        }))

      return NextResponse.json({
        success: true,
        methods,
        providers: registeredProviders.map((p) => ({
          provider: p,
          isActive: true,
          testMode: true,
        })),
      })
    }

    // Use DB config to determine enabled methods
    const activeProviders = new Set(providerConfigs.map((c) => c.provider))
    const methods: Array<{ method: string; provider: string; enabled: boolean }> = []

    for (const config of providerConfigs) {
      if (!registeredProviders.includes(config.provider)) {
        continue
      }

      for (const method of config.supportedMethods) {
        methods.push({
          method,
          provider: config.provider,
          enabled: true,
        })
      }
    }

    // Also include methods from registered providers that have no DB config
    // but are mapped in METHOD_PROVIDER_MAP (e.g., Stripe is always available)
    for (const [method, provider] of Object.entries(METHOD_PROVIDER_MAP)) {
      if (
        registeredProviders.includes(provider) &&
        !activeProviders.has(provider) &&
        !methods.some((m) => m.method === method)
      ) {
        methods.push({
          method,
          provider,
          enabled: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      methods,
      providers: providerConfigs.map((c) => ({
        provider: c.provider,
        isActive: true,
        testMode: c.testMode,
      })),
    })
  } catch (error) {
    console.error('List payment methods error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    )
  }
}

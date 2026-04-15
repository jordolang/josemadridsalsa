import { EventEmitter } from 'events'

/**
 * Event types emitted by the scraper
 */
export type ScraperEventType =
  | 'lead:found'
  | 'lead:contact_parsed'
  | 'campaign:status_changed'
  | 'campaign:progress'
  | 'campaign:error'

/**
 * Event payload types
 */
export interface LeadFoundEvent {
  campaignId: string
  lead: {
    id: string
    schoolName: string
    schoolUrl: string
    status: string
  }
}

export interface LeadContactParsedEvent {
  campaignId: string
  leadId: string
  contact: {
    email?: string
    phone?: string
    contactName?: string
    title?: string
    sport?: string
  }
}

export interface CampaignStatusChangedEvent {
  campaignId: string
  status: string
  message?: string
}

export interface CampaignProgressEvent {
  campaignId: string
  currentStep: 'search' | 'parse' | 'send'
  progress: {
    current: number
    total: number
  }
}

export interface CampaignErrorEvent {
  campaignId: string
  error: string
  step?: string
}

export type ScraperEvent =
  | { type: 'lead:found'; data: LeadFoundEvent }
  | { type: 'lead:contact_parsed'; data: LeadContactParsedEvent }
  | { type: 'campaign:status_changed'; data: CampaignStatusChangedEvent }
  | { type: 'campaign:progress'; data: CampaignProgressEvent }
  | { type: 'campaign:error'; data: CampaignErrorEvent }

type EventCallback = (event: ScraperEvent) => void

/**
 * In-memory event bus for scraper events
 * Provides campaign-scoped pub/sub functionality with automatic cleanup
 */
class EventBus {
  private emitter = new EventEmitter()
  private listeners = new Map<string, Set<EventCallback>>()
  private readonly MAX_LISTENERS_PER_CAMPAIGN = 50
  private readonly LISTENER_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  /**
   * Subscribe to events for a specific campaign
   */
  subscribe(campaignId: string, callback: EventCallback): () => void {
    if (!this.listeners.has(campaignId)) {
      this.listeners.set(campaignId, new Set())
    }

    const callbacks = this.listeners.get(campaignId)!

    if (callbacks.size >= this.MAX_LISTENERS_PER_CAMPAIGN) {
      return () => {}
    }

    // Use the same function reference for both the Set and the EventEmitter
    callbacks.add(callback)
    this.emitter.on(`campaign:${campaignId}`, callback)

    const timeoutId = setTimeout(() => {
      this.unsubscribe(campaignId, callback)
    }, this.LISTENER_TIMEOUT_MS)

    return () => {
      clearTimeout(timeoutId)
      this.unsubscribe(campaignId, callback)
    }
  }

  /**
   * Unsubscribe from campaign events
   */
  private unsubscribe(campaignId: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(campaignId)
    if (callbacks) {
      callbacks.delete(callback)
      this.emitter.removeListener(`campaign:${campaignId}`, callback as any)

      // Cleanup empty campaign listeners
      if (callbacks.size === 0) {
        this.listeners.delete(campaignId)
        this.emitter.removeAllListeners(`campaign:${campaignId}`)
      }
    }
  }

  /**
   * Publish event for a campaign
   */
  emit(event: ScraperEvent): void {
    const { data } = event

    // Ensure we have the campaignId from the data payload
    const campaignId = (data as any).campaignId

    if (!campaignId) {
      console.error('[EventBus] Event missing campaignId:', event)
      return
    }

    this.emitter.emit(`campaign:${campaignId}`, event)
  }

  /**
   * Clear all listeners for a campaign (e.g., when scraping completes)
   */
  clearCampaign(campaignId: string): void {
    this.listeners.delete(campaignId)
    this.emitter.removeAllListeners(`campaign:${campaignId}`)
  }

  /**
   * Get listener count for a campaign (for debugging)
   */
  getListenerCount(campaignId: string): number {
    return this.listeners.get(campaignId)?.size ?? 0
  }

  /**
   * Get all active campaigns (for debugging)
   */
  getActiveCampaigns(): string[] {
    return Array.from(this.listeners.keys())
  }
}

// Export singleton instance
export const eventBus = new EventBus()

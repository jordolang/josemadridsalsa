export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED'

export type PrimaryCtaAction =
  | 'update-status'
  | 'add-tracking'
  | 'view-tracking'
  | 'send-email'

export interface PrimaryCta {
  label: string
  action: PrimaryCtaAction
  nextStatus?: OrderStatus
}

interface CtaInput {
  status: OrderStatus
  paymentStatus: string
  hasTracking: boolean
}

export function getOrderPrimaryCta({ status, hasTracking }: CtaInput): PrimaryCta {
  switch (status) {
    case 'PENDING':
      return { label: 'Confirm order', action: 'update-status', nextStatus: 'CONFIRMED' }
    case 'CONFIRMED':
      return { label: 'Start processing', action: 'update-status', nextStatus: 'PROCESSING' }
    case 'PROCESSING':
      return hasTracking
        ? { label: 'Mark shipped', action: 'update-status', nextStatus: 'SHIPPED' }
        : { label: 'Add tracking', action: 'add-tracking' }
    case 'SHIPPED':
      return { label: 'View tracking', action: 'view-tracking' }
    case 'DELIVERED':
      return { label: 'Send thank-you', action: 'send-email' }
    case 'CANCELLED':
    case 'REFUNDED':
      return { label: 'Send email', action: 'send-email' }
  }
}

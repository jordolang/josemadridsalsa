import React from 'react'
import { Text, Section } from '@react-email/components'
import { EmailLayout } from '@/emails/components/EmailLayout'
import { EmailHeader } from '@/emails/components/EmailHeader'
import { EmailFooter } from '@/emails/components/EmailFooter'
import { Button } from '@/emails/components/Button'

interface ProductInfo {
  name: string
  sku: string
  currentStock: number
  threshold: number
}

interface LowStockAlertEmailProps {
  recipientName: string
  products: ProductInfo[]
  inventoryUrl: string
  supportEmail?: string
  unsubscribeUrl: string
}

export function LowStockAlertEmail({
  recipientName,
  products,
  inventoryUrl,
  supportEmail = 'support@josemadridsalsa.com',
  unsubscribeUrl,
}: LowStockAlertEmailProps) {
  const productCount = products.length
  const previewText =
    productCount === 1
      ? `Low stock alert: ${products[0].name} is running low`
      : `Low stock alert: ${productCount} products are running low`

  return React.createElement(
    EmailLayout,
    { previewText },
    React.createElement(EmailHeader, null),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 24px',
            fontSize: '24px',
            fontWeight: '700',
            color: '#dc2626',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.3',
          },
        },
        'Low Stock Alert'
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Hi ${recipientName},`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        productCount === 1
          ? 'The following product has reached its low stock threshold:'
          : `The following ${productCount} products have reached their low stock thresholds:`
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'Products Requiring Attention:'
      ),
      ...products.map((product) =>
        React.createElement(
          Section,
          {
            key: product.sku,
            style: {
              padding: '12px',
              margin: '0 0 12px',
              backgroundColor: '#fef2f2',
              borderRadius: '4px',
            },
          },
          React.createElement(
            Text,
            {
              style: {
                margin: '0 0 4px',
                fontSize: '16px',
                fontWeight: '600',
                color: '#1f2937',
                fontFamily: 'Arial, sans-serif',
                lineHeight: '1.6',
              },
            },
            product.name
          ),
          React.createElement(
            Text,
            {
              style: {
                margin: '0 0 4px',
                fontSize: '14px',
                color: '#4b5563',
                fontFamily: 'Arial, sans-serif',
                lineHeight: '1.6',
              },
            },
            `SKU: ${product.sku}`
          ),
          React.createElement(
            Text,
            {
              style: {
                margin: '0',
                fontSize: '14px',
                color: '#dc2626',
                fontWeight: '600',
                fontFamily: 'Arial, sans-serif',
                lineHeight: '1.6',
              },
            },
            `Current Stock: ${product.currentStock} (Threshold: ${product.threshold})`
          )
        )
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '16px 0',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'Please review your inventory and consider placing a reorder to avoid stockouts.'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '24px 0', textAlign: 'center' as const } },
      React.createElement(
        Button,
        {
          href: inventoryUrl,
          variant: 'primary',
          size: 'medium',
        },
        'View Inventory'
      )
    ),
    React.createElement(
      Section,
      { style: { padding: '0', margin: '24px 0' } },
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        'This is an automated alert to help you maintain optimal inventory levels.'
      ),
      React.createElement(
        Text,
        {
          style: {
            margin: '0 0 16px',
            fontSize: '16px',
            color: '#1f2937',
            fontFamily: 'Arial, sans-serif',
            lineHeight: '1.6',
          },
        },
        `Questions? Contact us at ${supportEmail}.`
      )
    ),
    React.createElement(EmailFooter, { unsubscribeUrl })
  )
}

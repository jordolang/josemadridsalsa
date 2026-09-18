'use client'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image as PdfImage,
  Link,
} from '@react-pdf/renderer'
import type { LeadCampaign, Lead } from '@prisma/client'

export interface PdfOptions {
  includePhotos: boolean
  emailsOnly: boolean
  groupByDomain: boolean
  summaryOnly: boolean
  includeActivityLog: boolean
}

export const DEFAULT_PDF_OPTIONS: PdfOptions = {
  includePhotos: false,
  emailsOnly: true,
  groupByDomain: true,
  summaryOnly: false,
  includeActivityLog: false,
}

// Brand colors (Jose Madrid Salsa primary green + neutral grays)
const BRAND = {
  primary: '#0f766e',
  primaryDark: '#115e59',
  accent: '#f59e0b',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  bg: '#ffffff',
  cardBg: '#fafafa',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: BRAND.text,
    backgroundColor: BRAND.bg,
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  coverPage: {
    fontFamily: 'Helvetica',
    color: BRAND.text,
    backgroundColor: BRAND.bg,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 48,
  },
  coverBand: {
    height: 6,
    width: '100%',
    backgroundColor: BRAND.primary,
    marginBottom: 36,
  },
  coverEyebrow: {
    fontSize: 11,
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
    color: BRAND.primaryDark,
  },
  coverSubtitle: {
    fontSize: 14,
    color: BRAND.muted,
    marginBottom: 40,
  },
  coverMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 24,
    borderTop: `1px solid ${BRAND.border}`,
    paddingTop: 24,
  },
  coverMetaCell: {
    width: '50%',
    paddingVertical: 8,
  },
  coverMetaLabel: {
    fontSize: 9,
    color: BRAND.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  coverMetaValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.text,
  },
  coverFooter: {
    position: 'absolute',
    bottom: 56,
    left: 48,
    right: 48,
    fontSize: 9,
    color: BRAND.muted,
    borderTop: `1px solid ${BRAND.border}`,
    paddingTop: 12,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND.primaryDark,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 10,
    color: BRAND.muted,
    marginBottom: 18,
  },
  leadCard: {
    borderLeft: `3px solid ${BRAND.primary}`,
    backgroundColor: BRAND.cardBg,
    padding: 12,
    marginBottom: 16,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  leadName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
  },
  leadMeta: {
    fontSize: 9,
    color: BRAND.muted,
    marginBottom: 4,
  },
  leadLink: {
    fontSize: 9,
    color: BRAND.primary,
    textDecoration: 'underline',
    marginBottom: 8,
  },
  contactTable: {
    marginTop: 8,
    borderTop: `1px solid ${BRAND.border}`,
  },
  contactRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottom: `1px solid ${BRAND.border}`,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottom: `1px solid ${BRAND.muted}`,
    backgroundColor: BRAND.border,
  },
  contactCell: {
    fontSize: 9,
    paddingRight: 4,
  },
  contactHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    paddingRight: 4,
    color: BRAND.text,
  },
  previewImage: {
    width: 100,
    height: 60,
    objectFit: 'cover',
    marginBottom: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: BRAND.muted,
    borderTop: `1px solid ${BRAND.border}`,
    paddingTop: 8,
  },
  pill: {
    fontSize: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: BRAND.primary,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryHighlight: {
    marginBottom: 18,
    padding: 12,
    backgroundColor: BRAND.cardBg,
    borderLeft: `3px solid ${BRAND.accent}`,
  },
  summaryText: {
    fontSize: 10,
    color: BRAND.text,
  },
  activityBlock: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#18181b',
    color: '#e4e4e7',
  },
  activityLine: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: '#e4e4e7',
    marginBottom: 2,
  },
})

function safeHost(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function leadDisplayName(lead: Lead, isBusiness: boolean): string {
  return isBusiness
    ? lead.businessName || lead.schoolName
    : lead.schoolName || lead.businessName || 'Unnamed'
}

function leadUrl(lead: Lead, isBusiness: boolean): string | null {
  const url = isBusiness ? lead.website : lead.schoolUrl
  return url || null
}

interface LeadReportGroup {
  id: string
  name: string
  url: string | null
  contacts: Lead[]
}

function buildGroups(leads: Lead[], isBusiness: boolean, groupByDomain: boolean): LeadReportGroup[] {
  if (!groupByDomain) {
    return leads.map((l) => ({
      id: l.id,
      name: leadDisplayName(l, isBusiness),
      url: leadUrl(l, isBusiness),
      contacts: [l],
    }))
  }

  const map = new Map<string, LeadReportGroup>()
  for (const lead of leads) {
    const url = leadUrl(lead, isBusiness)
    const name = leadDisplayName(lead, isBusiness)
    const key = `${name}|${safeHost(url)}`
    const existing = map.get(key)
    if (existing) {
      existing.contacts.push(lead)
    } else {
      map.set(key, { id: key, name, url, contacts: [lead] })
    }
  }
  return Array.from(map.values())
}

interface PdfReportProps {
  campaign: Pick<
    LeadCampaign,
    | 'name'
    | 'city'
    | 'state'
    | 'leadType'
    | 'businessCategory'
    | 'schoolType'
    | 'createdAt'
    | 'totalFound'
    | 'totalEmailsFound'
  >
  leads: Lead[]
  options: PdfOptions
  activityLog?: string[]
}

export function PdfReport({ campaign, leads, options, activityLog }: PdfReportProps) {
  const isBusiness = campaign.leadType === 'LOCAL_BUSINESS'

  const filteredLeads = options.emailsOnly ? leads.filter((l) => l.email) : leads
  const groups = buildGroups(filteredLeads, isBusiness, options.groupByDomain)

  const emailCount = filteredLeads.filter((l) => l.email).length
  const generatedOn = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" style={styles.coverPage}>
        <View style={styles.coverBand} />
        <Text style={styles.coverEyebrow}>Lead Generation Report</Text>
        <Text style={styles.coverTitle}>{campaign.name}</Text>
        <Text style={styles.coverSubtitle}>
          {campaign.city}, {campaign.state}
          {isBusiness && campaign.businessCategory ? ` · ${campaign.businessCategory}` : ''}
          {!isBusiness && campaign.schoolType ? ` · ${campaign.schoolType}` : ''}
        </Text>

        <View style={styles.coverMetaGrid}>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Lead Type</Text>
            <Text style={styles.coverMetaValue}>
              {campaign.leadType.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Campaign Created</Text>
            <Text style={styles.coverMetaValue}>
              {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>{isBusiness ? 'Businesses' : 'Schools'} in Report</Text>
            <Text style={styles.coverMetaValue}>{groups.length.toLocaleString()}</Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Contacts with Email</Text>
            <Text style={styles.coverMetaValue}>{emailCount.toLocaleString()}</Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Total Records</Text>
            <Text style={styles.coverMetaValue}>{filteredLeads.length.toLocaleString()}</Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Generated</Text>
            <Text style={styles.coverMetaValue}>{generatedOn}</Text>
          </View>
        </View>

        <Text style={styles.coverFooter}>
          Jose Madrid Salsa · Confidential · {generatedOn}
        </Text>
      </Page>

      {/* Leads Pages */}
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.sectionTitle}>
          {isBusiness ? 'Businesses' : 'Schools'} &amp; Contacts
        </Text>
        <Text style={styles.sectionSubtitle}>
          {groups.length} {groups.length === 1 ? 'entry' : 'entries'}
          {options.emailsOnly ? ' · filtered to leads with email' : ''}
        </Text>

        {options.summaryOnly && (
          <View style={styles.summaryHighlight}>
            <Text style={styles.summaryText}>
              Summary view: showing entity, source, and contact count. Toggle &ldquo;Summary
              only&rdquo; off to see full contact details.
            </Text>
          </View>
        )}

        {groups.map((group) => (
          <View key={group.id} style={styles.leadCard} wrap={false}>
            <View style={styles.leadHeader}>
              <Text style={styles.leadName}>{group.name}</Text>
              <Text style={styles.pill}>
                {group.contacts.length}{' '}
                {group.contacts.length === 1 ? 'contact' : 'contacts'}
              </Text>
            </View>
            {group.url ? (
              <Link src={group.url} style={styles.leadLink}>
                {safeHost(group.url)}
              </Link>
            ) : (
              <Text style={styles.leadMeta}>No source URL</Text>
            )}

            {options.includePhotos && group.url && (
              <PdfImage
                src={`https://image.thum.io/get/width/300/${encodeURIComponent(group.url)}`}
                style={styles.previewImage}
              />
            )}

            {!options.summaryOnly && group.contacts.length > 0 && (
              <View style={styles.contactTable}>
                <View style={styles.contactHeaderRow}>
                  {!isBusiness && (
                    <Text style={[styles.contactHeaderCell, { flex: 1 }]}>Sport</Text>
                  )}
                  <Text style={[styles.contactHeaderCell, { flex: 1.4 }]}>Contact</Text>
                  <Text style={[styles.contactHeaderCell, { flex: 1.6 }]}>Title</Text>
                  <Text style={[styles.contactHeaderCell, { flex: 2.4 }]}>Email</Text>
                  <Text style={[styles.contactHeaderCell, { flex: 1.4 }]}>Phone</Text>
                  <Text style={[styles.contactHeaderCell, { flex: 1.2 }]}>Status</Text>
                </View>
                {group.contacts.map((c) => (
                  <View key={c.id} style={styles.contactRow}>
                    {!isBusiness && (
                      <Text style={[styles.contactCell, { flex: 1 }]}>{c.sport || '—'}</Text>
                    )}
                    <Text style={[styles.contactCell, { flex: 1.4 }]}>
                      {c.contactName || '—'}
                    </Text>
                    <Text style={[styles.contactCell, { flex: 1.6 }]}>
                      {c.title || '—'}
                    </Text>
                    <Text style={[styles.contactCell, { flex: 2.4, color: BRAND.primary }]}>
                      {c.email || '—'}
                    </Text>
                    <Text style={[styles.contactCell, { flex: 1.4 }]}>{c.phone || '—'}</Text>
                    <Text style={[styles.contactCell, { flex: 1.2, color: BRAND.muted }]}>
                      {c.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {groups.length === 0 && (
          <View style={styles.summaryHighlight}>
            <Text style={styles.summaryText}>
              No leads matched the current filters. Adjust &ldquo;Emails only&rdquo; or run
              the scraper to collect more data.
            </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{campaign.name}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>

      {/* Activity Log (optional) */}
      {options.includeActivityLog && activityLog && activityLog.length > 0 && (
        <Page size="LETTER" style={styles.page} wrap>
          <Text style={styles.sectionTitle}>Activity Log</Text>
          <Text style={styles.sectionSubtitle}>
            Captured scraper output from this session
          </Text>
          <View style={styles.activityBlock}>
            {activityLog.slice(-100).map((line, i) => (
              <Text key={i} style={styles.activityLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.footer} fixed>
            <Text>{campaign.name}</Text>
            <Text
              render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            />
          </View>
        </Page>
      )}
    </Document>
  )
}

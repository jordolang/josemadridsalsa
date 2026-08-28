'use client'

import { Icon } from './icons'
import type {
  AnalyticsPayload,
  Cell as CellData,
  Column,
  DashboardPayload,
  EventsPayload,
  Inspector as InspectorData,
  LinkPayload,
  Row,
  SettingsPayload,
  Tone,
} from '@/lib/admin-desktop/types'

const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function toneClass(tone: Tone | undefined): string {
  return tone ? `jmsd-tone-${tone}` : ''
}

function cellClass(cell: CellData): string {
  return [
    'jmsd-cell',
    cell.right ? 'jmsd-cell--right' : '',
    cell.mono ? 'jmsd-cell--mono' : '',
    cell.dim ? 'jmsd-cell--dim' : '',
    cell.strong ? 'jmsd-cell--strong' : '',
    toneClass(cell.tone),
  ]
    .filter(Boolean)
    .join(' ')
}

function Cell({ cell }: { cell: CellData }) {
  return (
    <span className={cellClass(cell)} title={cell.text || undefined}>
      {cell.dot ? <span className="jmsd-cell-dot" /> : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.text}</span>
    </span>
  )
}

function gridTemplate(columns: Column[]): string {
  return columns.map((column) => column.width).join(' ')
}

// ---------------------------------------------------------------- table view

export function TableView({
  columns,
  rows,
  totals,
  selected,
  onSelect,
  onOpen,
  emptyLabel,
}: {
  columns: Column[]
  rows: Row[]
  totals?: CellData[]
  selected: number
  onSelect: (index: number) => void
  onOpen: (row: Row) => void
  emptyLabel: string
}) {
  const template = gridTemplate(columns)

  return (
    <div>
      <div className="jmsd-thead" style={{ gridTemplateColumns: template }}>
        {columns.map((column) => (
          <span key={column.label} style={{ textAlign: column.right ? 'right' : 'left' }}>
            {column.label}
          </span>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="jmsd-empty">{emptyLabel}</div>
      ) : (
        <div role="listbox" aria-label="Rows">
          {rows.map((row, index) => (
            <button
              key={row.id}
              type="button"
              role="option"
              className="jmsd-row"
              style={{ gridTemplateColumns: template }}
              aria-selected={index === selected}
              onClick={() => onSelect(index)}
              onDoubleClick={() => onOpen(row)}
            >
              {row.cells.map((cell, cellIndex) => (
                <Cell key={cellIndex} cell={cell} />
              ))}
            </button>
          ))}
        </div>
      )}

      {totals && rows.length > 0 ? (
        <div className="jmsd-tfoot" style={{ gridTemplateColumns: template }}>
          {totals.map((cell, index) => (
            <span
              key={index}
              className={[
                cell.right ? 'jmsd-cell--right' : '',
                cell.strong ? 'jmsd-cell--strong' : '',
                toneClass(cell.tone),
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ textAlign: cell.right ? 'right' : 'left' }}
            >
              {cell.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------ dashboard view

export function DashboardView({
  payload,
  onOpen,
}: {
  payload: DashboardPayload
  onOpen: (href: string) => void
}) {
  return (
    <div className="jmsd-padded">
      <div className="jmsd-stats">
        {payload.stats.map((stat) => (
          <div key={stat.label} className="jmsd-card jmsd-card--pad">
            <div className="jmsd-stat-label">{stat.label}</div>
            <div className="jmsd-stat-value">{stat.value}</div>
            <div className={`jmsd-stat-note ${toneClass(stat.tone)}`}>{stat.note}</div>
          </div>
        ))}
      </div>

      <div className="jmsd-dash-grid">
        <div className="jmsd-card">
          <div className="jmsd-card-head">Today’s orders</div>
          {payload.todayOrders.length === 0 ? (
            <div className="jmsd-empty">Nothing placed yet today.</div>
          ) : (
            payload.todayOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                className="jmsd-listrow"
                style={{ gridTemplateColumns: '96px minmax(0,1fr) 84px 80px' }}
                onClick={() => onOpen(order.href)}
              >
                <span className="jmsd-mono jmsd-cell--dim">{order.id}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {order.customer}
                </span>
                <span className="jmsd-cell--dim" style={{ fontSize: 10.5 }}>
                  {order.channel}
                </span>
                <span className="jmsd-mono" style={{ textAlign: 'right' }}>
                  {order.total}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="jmsd-stack">
          <div className="jmsd-card">
            <div className="jmsd-card-head">
              <Icon name="i-alert" size={13} className="jmsd-tone-warn" />
              At or below reorder point
            </div>
            {payload.lowStock.length === 0 ? (
              <div className="jmsd-empty">Every SKU is above its reorder point.</div>
            ) : (
              payload.lowStock.map((item) => (
                <div
                  key={item.name}
                  className="jmsd-listrow"
                  style={{ gridTemplateColumns: '1fr 54px 46px', cursor: 'default' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                  <span className="jmsd-mono jmsd-cell--dim" style={{ textAlign: 'right' }}>
                    {item.available}
                  </span>
                  <span className="jmsd-mono jmsd-tone-bad" style={{ textAlign: 'right' }}>
                    {item.gap}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="jmsd-card">
            <div className="jmsd-card-head">
              <Icon name="i-pin" size={13} className="jmsd-tone-accent" />
              Where is Jose — next up
            </div>
            {payload.nextEvents.length === 0 ? (
              <div className="jmsd-empty">No upcoming shows on the calendar.</div>
            ) : (
              payload.nextEvents.map((event) => (
                <div
                  key={`${event.date}-${event.name}`}
                  className="jmsd-listrow"
                  style={{ gridTemplateColumns: '66px 1fr auto', cursor: 'default' }}
                >
                  <span className="jmsd-mono jmsd-cell--dim">{event.date}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.name}
                  </span>
                  <span className="jmsd-cell--dim" style={{ fontSize: 10.5 }}>
                    {event.city}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ analytics view

export function AnalyticsView({ payload }: { payload: AnalyticsPayload }) {
  const height = (value: number) => Math.max(1, Math.round((value / payload.barMax) * 132))

  return (
    <div className="jmsd-padded">
      <div className="jmsd-stats" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        {payload.kpis.map((kpi) => (
          <div key={kpi.label} className="jmsd-card jmsd-card--pad">
            <div className="jmsd-stat-label">{kpi.label}</div>
            <div className="jmsd-stat-value" style={{ fontSize: 24 }}>
              {kpi.value}
            </div>
            <div className={`jmsd-stat-note ${toneClass(kpi.tone)}`}>{kpi.note}</div>
          </div>
        ))}
      </div>

      <div className="jmsd-card jmsd-card--pad" style={{ marginTop: 10 }}>
        <div className="jmsd-legend">
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>Revenue by month</span>
          <span>
            <span className="jmsd-swatch" style={{ background: 'var(--gold)' }} /> This year
          </span>
          <span>
            <span className="jmsd-swatch" style={{ background: 'var(--line)' }} /> Year before
          </span>
        </div>
        <div className="jmsd-bars">
          {payload.bars.map((bar) => (
            <div key={bar.label} className="jmsd-bar-col">
              <div className="jmsd-bar-pair">
                <span className="jmsd-bar" style={{ height: height(bar.previous) }} />
                <span className="jmsd-bar jmsd-bar--current" style={{ height: height(bar.current) }} />
              </div>
              <span className={`jmsd-bar-label ${bar.highlight ? 'jmsd-bar-label--now' : ''}`}>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="jmsd-two-up">
        <div className="jmsd-card">
          <div className="jmsd-card-head">Channel mix — trailing 12 months</div>
          {payload.channels.length === 0 ? (
            <div className="jmsd-empty">No paid orders in the window.</div>
          ) : (
            payload.channels.map((channel) => (
              <div
                key={channel.name}
                className="jmsd-listrow"
                style={{ gridTemplateColumns: 'minmax(96px,1fr) 1fr 84px 44px', height: 34, cursor: 'default' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {channel.name}
                </span>
                <span className="jmsd-meter" style={{ width: `${Math.round(channel.fraction * 100)}%` }} />
                <span className="jmsd-mono" style={{ textAlign: 'right' }}>
                  {channel.amount}
                </span>
                <span className="jmsd-mono jmsd-cell--dim" style={{ textAlign: 'right' }}>
                  {channel.pct}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="jmsd-card">
          <div className="jmsd-card-head">Top products — trailing 12 months</div>
          {payload.topProducts.length === 0 ? (
            <div className="jmsd-empty">No items sold in the window.</div>
          ) : (
            payload.topProducts.map((product) => (
              <div
                key={product.name}
                className="jmsd-listrow"
                style={{ gridTemplateColumns: 'minmax(0,1fr) 68px 96px', height: 34, cursor: 'default' }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.name}
                </span>
                <span className="jmsd-mono jmsd-cell--dim" style={{ textAlign: 'right' }}>
                  {product.jars}
                </span>
                <span className="jmsd-mono" style={{ textAlign: 'right' }}>
                  {product.revenue}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="jmsd-card" style={{ marginTop: 10 }}>
        <div className="jmsd-card-head">Retention by the quarter a buyer first ordered</div>
        {payload.cohorts.length === 0 ? (
          <div className="jmsd-empty">Not enough order history to build cohorts.</div>
        ) : (
          payload.cohorts.map((cohort) => (
            <div
              key={cohort.quarter}
              className="jmsd-listrow"
              style={{ gridTemplateColumns: '96px minmax(0,1fr) 140px 120px', cursor: 'default' }}
            >
              <span className="jmsd-mono jmsd-cell--dim">{cohort.quarter}</span>
              <span>{cohort.customers}</span>
              <span className="jmsd-mono">{cohort.returned}</span>
              <span className="jmsd-mono" style={{ textAlign: 'right' }}>
                {cohort.ltv}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------- events view

export function EventsView({
  payload,
  selected,
  onSelect,
  onOpen,
}: {
  payload: EventsPayload
  selected: number
  onSelect: (index: number) => void
  onOpen: (row: Row) => void
}) {
  return (
    <div className="jmsd-padded">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="jmsd-serif" style={{ fontSize: 15 }}>
          {payload.monthLabel}
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{payload.monthSummary}</span>
      </div>

      <div className="jmsd-calendar">
        {DOW.map((day) => (
          <div key={day} className="jmsd-cal-dow">
            {day}
          </div>
        ))}
        {payload.days.map((day, index) => (
          <div
            key={index}
            className={[
              'jmsd-cal-day',
              day.inMonth ? '' : 'jmsd-cal-day--outside',
              day.today ? 'jmsd-cal-day--today' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="jmsd-cal-num">{day.day}</span>
            {day.events.map((event, eventIndex) => (
              <div key={eventIndex} className="jmsd-cal-event" title={event}>
                {event}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="jmsd-card" style={{ marginTop: 14 }}>
        <div className="jmsd-card-head">Every show on record</div>
        <TableView
          columns={payload.columns}
          rows={payload.rows}
          selected={selected}
          onSelect={onSelect}
          onOpen={onOpen}
          emptyLabel="No shows recorded yet."
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------- settings view

export function SettingsView({ payload }: { payload: SettingsPayload }) {
  return (
    <div className="jmsd-settings-grid">
      {payload.groups.map((group) => (
        <div key={group.label} className="jmsd-card">
          <div className="jmsd-settings-head">{group.label}</div>
          {group.rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="jmsd-settings-row">
              <span>{row.label}</span>
              <span
                className={[
                  'jmsd-settings-value',
                  row.mono ? 'jmsd-mono' : '',
                  toneClass(row.tone),
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------- link view

export function LinkView({
  heading,
  payload,
  onOpen,
}: {
  heading: string
  payload: LinkPayload
  onOpen: (href: string) => void
}) {
  return (
    <div className="jmsd-link-view">
      <div className="jmsd-link-view-inner">
        <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--faint)', fontWeight: 700 }}>
          LIVES IN THE WEB ADMIN
        </div>
        <div className="jmsd-serif" style={{ fontSize: 20, marginTop: 6 }}>
          {heading}
        </div>
        <div style={{ marginTop: 8, color: 'var(--dim)', fontSize: 12, lineHeight: 1.6 }}>{payload.note}</div>
        <div className="jmsd-card" style={{ marginTop: 14 }}>
          {payload.views.map((view) => (
            <button key={view.path} type="button" className="jmsd-link-row" onClick={() => onOpen(view.path)}>
              <Icon name="i-chev" size={13} className="jmsd-tone-muted" />
              <span>{view.label}</span>
              <span className="jmsd-mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)' }}>
                {view.path}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ inspector

export function Inspector({ data }: { data: InspectorData | null }) {
  return (
    <aside className="jmsd-inspector">
      <div className="jmsd-inspector-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'var(--faint)', fontWeight: 700 }}>
            INSPECTOR
          </div>
          <div className="jmsd-inspector-title" title={data?.title}>
            {data?.title ?? '—'}
          </div>
        </div>
        {data?.tag ? <span className={`jmsd-tag ${toneClass(data.tagTone)}`}>{data.tag}</span> : null}
      </div>

      <div className="jmsd-inspector-body">
        {data ? (
          data.groups.map((group) => (
            <div key={group.label} className="jmsd-inspector-group">
              <div className="jmsd-inspector-group-label">{group.label}</div>
              {(group.fields ?? []).map((field, index) => (
                <div key={`${field.label}-${index}`} className="jmsd-field">
                  <span>{field.label}</span>
                  <span
                    className={[
                      'jmsd-field-value',
                      field.mono ? 'jmsd-mono' : '',
                      field.strong ? 'jmsd-cell--strong' : '',
                      field.wrap ? 'jmsd-field-value--wrap' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={field.value}
                  >
                    {field.value}
                  </span>
                </div>
              ))}
              {(group.lines ?? []).map((line, index) => (
                <div key={`${line.name}-${index}`} className="jmsd-inspector-line">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {line.name}
                  </span>
                  <span className="jmsd-mono jmsd-cell--dim" style={{ textAlign: 'right' }}>
                    {line.qty}
                  </span>
                  <span className="jmsd-mono" style={{ textAlign: 'right' }}>
                    {line.amount}
                  </span>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="jmsd-empty">Nothing selected.</div>
        )}
      </div>
    </aside>
  )
}

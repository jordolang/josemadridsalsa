'use client'

import { useCallback, useRef } from 'react'
import { Icon } from './icons'
import { clampWidth, columnKey, gridTemplate } from '@/lib/admin-desktop/columns'
import type {
  AnalyticsPayload,
  Cell as CellData,
  Column,
  DashboardPayload,
  DesktopCommand,
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

// ---------------------------------------------------------------- table view

/** The modifier keys a row click carries, which decide whether it marks rows. */
export type RowClick = Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey'>

export function TableView({
  columns,
  rows,
  totals,
  selected,
  marked,
  onSelect,
  onOpen,
  emptyLabel,
  widths,
  onResize,
  onResetColumn,
}: {
  columns: Column[]
  rows: Row[]
  totals?: CellData[]
  selected: number
  /** Row ids marked for a bulk action. */
  marked?: ReadonlySet<string>
  onSelect: (index: number, click?: RowClick) => void
  onOpen: (row: Row) => void
  emptyLabel: string
  /** Hand-set widths for this section, by column key. */
  widths?: Record<string, number>
  onResize?: (key: string, width: number) => void
  /** Double-clicking a handle puts that column back on the loader's track. */
  onResetColumn?: (key: string) => void
}) {
  const template = gridTemplate(columns, widths)

  return (
    <div>
      <div className="jmsd-thead" style={{ gridTemplateColumns: template }}>
        {columns.map((column, index) => (
          <span
            key={columnKey(column, index)}
            className="jmsd-th"
            style={{ textAlign: column.right ? 'right' : 'left' }}
          >
            <span className="jmsd-th-label">{column.label}</span>
            {onResize ? (
              <ResizeHandle
                column={column}
                columnKey={columnKey(column, index)}
                onResize={onResize}
                onReset={onResetColumn}
              />
            ) : null}
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
              data-marked={marked?.has(row.id) || undefined}
              onClick={(event) => onSelect(index, event)}
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

/**
 * The grab strip on a column's trailing edge.
 *
 * The width it starts from is measured rather than read from the column's
 * declared track, because most of those tracks are flexible (`minmax(0,1.5fr)`)
 * and have no pixel value until the browser has laid them out. Pointer capture
 * keeps the drag alive when the cursor outruns the 5px strip, and the arrow keys
 * do the same job for anyone not using a mouse.
 */
function ResizeHandle({
  column,
  columnKey: key,
  onResize,
  onReset,
}: {
  column: Column
  columnKey: string
  onResize: (key: string, width: number) => void
  onReset?: (key: string) => void
}) {
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  const measure = useCallback((node: HTMLElement | null) => {
    const header = node?.closest('.jmsd-th')
    const width = header instanceof HTMLElement ? header.getBoundingClientRect().width : 0
    // A header that has not been laid out yet measures zero, and resizing from
    // zero would collapse the column on the first nudge.
    return width || MIN_MEASURED
  }, [])

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${column.label}`}
      tabIndex={0}
      className="jmsd-col-handle"
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        drag.current = { startX: event.clientX, startWidth: measure(event.currentTarget) }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        onResize(key, clampWidth(drag.current.startWidth + (event.clientX - drag.current.startX), column))
      }}
      onPointerUp={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => {
        drag.current = null
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onReset?.(key)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        const step = event.shiftKey ? 24 : 8
        const width = measure(event.currentTarget)
        onResize(key, clampWidth(width + (event.key === 'ArrowRight' ? step : -step), column))
      }}
    />
  )
}

/** Stands in for a header that has no layout box yet. */
const MIN_MEASURED = 120

// ------------------------------------------------------------ dashboard view

export function DashboardView({
  payload,
  onRun,
}: {
  payload: DashboardPayload
  onRun: (command: DesktopCommand) => void
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
                onClick={() => onRun(order.open)}
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
                <button
                  key={item.name}
                  type="button"
                  className="jmsd-listrow"
                  style={{ gridTemplateColumns: '1fr 54px 46px', cursor: item.open ? 'pointer' : 'default' }}
                  disabled={!item.open}
                  onClick={() => item.open && onRun(item.open)}
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
                </button>
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
                <button
                  key={`${event.date}-${event.name}`}
                  type="button"
                  className="jmsd-listrow"
                  style={{ gridTemplateColumns: '66px 1fr auto', cursor: event.open ? 'pointer' : 'default' }}
                  disabled={!event.open}
                  onClick={() => event.open && onRun(event.open)}
                >
                  <span className="jmsd-mono jmsd-cell--dim">{event.date}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.name}
                  </span>
                  <span className="jmsd-cell--dim" style={{ fontSize: 10.5 }}>
                    {event.city}
                  </span>
                </button>
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
  marked,
  onSelect,
  onOpen,
  widths,
  onResize,
  onResetColumn,
}: {
  payload: EventsPayload
  selected: number
  marked?: ReadonlySet<string>
  onSelect: (index: number, click?: RowClick) => void
  onOpen: (row: Row) => void
  widths?: Record<string, number>
  onResize?: (key: string, width: number) => void
  onResetColumn?: (key: string) => void
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
          marked={marked}
          onSelect={onSelect}
          onOpen={onOpen}
          emptyLabel="No shows recorded yet."
          widths={widths}
          onResize={onResize}
          onResetColumn={onResetColumn}
        />
      </div>
    </div>
  )
}

// ------------------------------------------------------------- settings view

export function SettingsView({
  payload,
  onRun,
}: {
  payload: SettingsPayload
  onRun: (command: DesktopCommand) => void
}) {
  return (
    <div className="jmsd-settings-grid">
      {payload.groups.map((group) => (
        <div key={group.label} className="jmsd-card">
          <div className="jmsd-settings-head">
            <span>{group.label}</span>
            {group.edit ? (
              <button
                type="button"
                className="jmsd-action jmsd-action--tiny"
                onClick={() => group.edit && onRun(group.edit)}
              >
                <Icon name="i-pencil" size={11} />
                <span>Edit</span>
              </button>
            ) : null}
          </div>
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

export function Inspector({
  data,
  onRun,
}: {
  data: InspectorData | null
  onRun: (command: DesktopCommand) => void
}) {
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

        {data?.actions?.length ? (
          <div className="jmsd-inspector-actions">
            {data.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={`jmsd-inspector-action ${action.danger ? 'jmsd-inspector-action--danger' : ''}`}
                onClick={() => onRun(action.command)}
              >
                <span>{action.label}</span>
                {action.shortcut ? (
                  <span className="jmsd-inspector-action-key">{action.shortcut}</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

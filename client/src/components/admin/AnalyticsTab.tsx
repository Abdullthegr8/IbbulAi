import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { getAnalytics } from '../../services/api'
import type { Analytics } from '../../types'

const GREEN = '#1A6B1A'
const RANGES = [7, 30, 90] as const
type Range = typeof RANGES[number]

const ROLE_LABELS: Record<string, string> = { guest: 'Guests', student: 'Students', staff: 'Staff', admin: 'Admin' }

function percent(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'
}

/** Rounds the axis maximum up to a clean number (1, 2, 5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  return [1, 2, 5, 10].map(m => m * pow).find(n => n >= value) ?? value
}

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-[12px] text-gray-500">{label}</p>
      <p className="font-display font-semibold text-2xl text-gray-800 mt-1">{value}</p>
      {note && <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

interface Column { key: string; label: string; tick?: string; value: number; detail?: string }

/** Single-series column chart with a hover tooltip and a table view. */
function ColumnChart({ title, subtitle, columns }: { title: string; subtitle: string; columns: Column[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...columns.map(c => c.value)))
  const active = hover !== null ? columns[hover] : null

  return (
    <figure className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <figcaption>
        <h3 className="font-display font-semibold text-[14px] text-gray-800">{title}</h3>
        <p className="text-[12px] text-gray-400">{subtitle}</p>
      </figcaption>

      <div className="mt-6 pl-7" onMouseLeave={() => setHover(null)}>
        <div className="relative h-40">
          {/* Gridlines with y ticks: max, half, 0 */}
          {[max, max / 2, 0].map((t, i) => (
            <div key={t} className="absolute left-0 right-0 flex items-center" style={{ top: `${i * 50}%`, transform: 'translateY(-50%)' }}>
              <span className="absolute -left-7 w-6 text-right text-[10px] text-gray-400 tabular-nums">{t}</span>
              <div className={`flex-1 h-px ${t === 0 ? 'bg-gray-200' : 'bg-gray-100'}`} />
            </div>
          ))}

          <div className="relative h-full flex items-end gap-[2px]" role="img" aria-label={`${title}. Use the table below for exact values.`}>
            {columns.map((c, i) => (
              <div key={c.key} className="flex-1 h-full flex items-end justify-center cursor-default"
                   onMouseEnter={() => setHover(i)}>
                <div className="w-full max-w-[24px] rounded-t transition-opacity"
                     style={{
                       height: `${(c.value / max) * 100}%`,
                       minHeight: c.value > 0 ? 2 : 0,
                       background: GREEN,
                       opacity: hover === null || hover === i ? 1 : 0.45,
                     }} />
              </div>
            ))}
          </div>

          {/* Tooltip, above the hovered column */}
          {active && hover !== null && (
            <div className="absolute top-0 z-10 pointer-events-none px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] shadow-lg whitespace-nowrap"
                 style={{
                   left: `${((hover + 0.5) / columns.length) * 100}%`,
                   // Keep it inside the card at the edges
                   transform: `translate(${hover < columns.length * 0.2 ? '-15%' : hover > columns.length * 0.8 ? '-85%' : '-50%'}, -110%)`,
                 }}>
              <span className="font-semibold">{active.label}</span>
              <span className="block text-white/80">{active.value} question{active.value === 1 ? '' : 's'}{active.detail ? ` · ${active.detail}` : ''}</span>
            </div>
          )}
        </div>

        {/* X axis: only the ticks provided */}
        <div className="flex gap-[2px] mt-1.5">
          {columns.map(c => (
            <span key={c.key} className="flex-1 min-w-0 flex justify-center text-[10px] text-gray-400 whitespace-nowrap">
              <span className="overflow-visible">{c.tick ?? ''}</span>
            </span>
          ))}
        </div>
      </div>

      <details className="mt-3">
        <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700">View as table</summary>
        <div className="max-h-48 overflow-y-auto scrollbar-thin mt-2">
          <table className="w-full text-[12px]">
            <tbody>
              {columns.map(c => (
                <tr key={c.key} className="border-b border-gray-100 last:border-0">
                  <td className="py-1 text-gray-600">{c.label}</td>
                  <td className="py-1 text-right text-gray-800 tabular-nums">{c.value}</td>
                  {columns.some(x => x.detail) && <td className="py-1 pl-3 text-right text-gray-400">{c.detail}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Ranked horizontal bars with the value at the tip. */
function BarList({ title, subtitle, rows }: { title: string; subtitle: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="font-display font-semibold text-[14px] text-gray-800">{title}</h3>
      <p className="text-[12px] text-gray-400 mb-4">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">No questions in this period</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(r => (
            <li key={r.label} className="flex items-center gap-3">
              <span className="text-[12px] text-gray-600 w-[120px] truncate flex-shrink-0" title={r.label}>{r.label}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div className="h-3 rounded-r" style={{ width: `${(r.value / max) * 100}%`, minWidth: 2, background: GREEN }} />
                <span className="text-[11px] font-semibold text-gray-600 tabular-nums">{r.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function AnalyticsTab() {
  const [range,   setRange]   = useState<Range>(30)
  const [data,    setData]    = useState<Analytics | null>(null)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    getAnalytics(range)
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [range])

  if (error) return <p className="text-sm text-red-500 py-8 text-center">Could not load analytics.</p>
  if (!data) return <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin" style={{ color: GREEN }} /></div>

  const { totals } = data
  const rated = totals.helpful + totals.not_helpful
  const tickEvery = data.days <= 7 ? 1 : data.days <= 30 ? 7 : 15

  const dailyColumns: Column[] = data.daily.map((d, i) => {
    const date = parseISO(d.day)
    return {
      key:    d.day,
      label:  format(date, 'EEE, MMM d'),
      tick:   (data.daily.length - 1 - i) % tickEvery === 0 ? format(date, data.days <= 7 ? 'EEE' : 'MMM d') : undefined,
      value:  d.questions,
      detail: d.unanswered ? `${d.unanswered} unanswered` : undefined,
    }
  })
  const hourColumns: Column[] = data.hours.map(h => ({
    key:   String(h.hour),
    label: `${String(h.hour).padStart(2, '0')}:00–${String(h.hour).padStart(2, '0')}:59`,
    tick:  h.hour % 6 === 0 ? `${String(h.hour).padStart(2, '0')}:00` : undefined,
    value: h.questions,
  }))

  return (
    <div className="flex flex-col gap-4">
      {/* Range filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-gray-500">Times are in West Africa Time (Lagos).</p>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r}
                    className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors ${range === r ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    style={range === r ? { background: GREEN } : undefined}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Questions asked" value={totals.questions.toLocaleString()} note={`Last ${data.days} days`} />
        <StatTile label="Answered from verified info" value={percent(totals.questions - totals.unanswered, totals.questions)}
                  note={`${totals.unanswered} sent to the inbox`} />
        <StatTile label="Rated helpful" value={percent(totals.helpful, rated)}
                  note={rated ? `${rated} rating${rated === 1 ? '' : 's'}` : 'No ratings yet'} />
        <StatTile label="Average response time" value={totals.avg_latency_ms != null ? `${(totals.avg_latency_ms / 1000).toFixed(1)}s` : '—'} />
      </div>

      <ColumnChart title="Questions per day" subtitle={`Last ${data.days} days`} columns={dailyColumns} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ColumnChart title="Busiest hours" subtitle="Questions by hour of day" columns={hourColumns} />
        <BarList title="Who's asking" subtitle="Questions by user type"
                 rows={data.roles.map(r => ({ label: ROLE_LABELS[r.role] ?? r.role, value: r.questions }))} />
      </div>

      <BarList title="Top topics" subtitle="Based on the knowledge base entry that matched each question"
               rows={data.topics.map(t => ({ label: t.topic, value: t.questions }))} />
    </div>
  )
}

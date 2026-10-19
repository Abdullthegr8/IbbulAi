import { useEffect, useState } from 'react'
import { Megaphone, X, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { getAnnouncements } from '../../services/api'
import type { Announcement } from '../../types'

const DISMISSED_KEY = 'unibot_dismissed_announcements'

function loadDismissed(): number[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]') } catch { return [] }
}

/** Pinned announcements, shown above the chat until dismissed. */
export default function AnnouncementBanner() {
  const [items,     setItems]     = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<number[]>(loadDismissed)
  const [expanded,  setExpanded]  = useState(false)

  useEffect(() => {
    getAnnouncements().then(a => setItems(a.filter(x => x.pinned))).catch(() => {})
  }, [])

  const visible = items.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null
  const [first, ...rest] = visible

  function dismissAll() {
    const next = [...dismissed, ...visible.map(a => a.id)]
    setDismissed(next)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-100))) } catch { /* ignore */ }
  }

  return (
    <div className="border-b px-4 py-2.5" style={{ background: '#fffbea', borderColor: '#f3e3a3' }} role="region" aria-label="Announcements">
      <div className="max-w-3xl mx-auto flex items-start gap-2.5">
        <Megaphone size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#8a6d00' }} />
        <div className="flex-1 min-w-0 text-[12px] leading-relaxed" style={{ color: '#5c4900' }}>
          {(expanded ? visible : [first]).map(a => (
            <p key={a.id} className={expanded ? 'mb-1.5 last:mb-0' : 'truncate'}>
              <span className="font-semibold">{a.title}</span>
              {' — '}{a.body}
              {expanded && <span className="opacity-60"> · {format(new Date(a.created_at), 'MMM d')}</span>}
            </p>
          ))}
          {rest.length > 0 && (
            <button onClick={() => setExpanded(v => !v)} className="inline-flex items-center gap-0.5 font-semibold mt-0.5 hover:underline">
              {expanded ? 'Show less' : `+${rest.length} more`}
              <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
            </button>
          )}
          {rest.length === 0 && !expanded && first.body.length > 80 && (
            <button onClick={() => setExpanded(true)} className="font-semibold hover:underline">Read more</button>
          )}
        </div>
        <button onClick={dismissAll} aria-label="Dismiss announcements" title="Dismiss"
                className="p-0.5 rounded hover:bg-black/5 flex-shrink-0" style={{ color: '#8a6d00' }}>
          <X size={14} />
        </button>
      </div>
    </div>
  )
}

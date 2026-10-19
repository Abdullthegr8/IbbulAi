import { useEffect, useState } from 'react'
import { useMatch, useNavigate } from 'react-router-dom'
import { FileText, Trash2, Loader2 } from 'lucide-react'
import { isToday, isYesterday, differenceInCalendarDays } from 'date-fns'
import toast from 'react-hot-toast'
import { deleteConversation, getConversations } from '../../services/api'
import { onConversationsChanged } from '../../hooks/conversationEvents'
import type { Conversation } from '../../types'

interface Props {
  owner:     string | undefined   // reload when the signed-in account changes
  onNavigate: () => void          // close the mobile drawer
}

function groupLabel(date: Date): string {
  if (isToday(date))     return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  const days = differenceInCalendarDays(new Date(), date)
  if (days < 7)  return 'Previous 7 days'
  if (days < 30) return 'Previous 30 days'
  return 'Older'
}

/** The signed-in user's saved conversations, newest first, grouped by date. */
export default function ConversationList({ owner, onNavigate }: Props) {
  const navigate = useNavigate()
  const activeId = useMatch('/chat/:conversationId')?.params.conversationId ?? null
  const [items,   setItems]   = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [reload,  setReload]  = useState(0)

  useEffect(() => onConversationsChanged(() => setReload(n => n + 1)), [])

  useEffect(() => {
    let cancelled = false
    getConversations()
      .then(c => { if (!cancelled) setItems(c) })
      .catch(() => { /* list stays as it was */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [owner, reload])

  async function remove(c: Conversation) {
    if (!confirm(`Delete "${c.title}"? This cannot be undone.`)) return
    try {
      await deleteConversation(c.id)
      setItems(list => list.filter(x => x.id !== c.id))
      if (c.id === activeId) navigate('/chat', { replace: true })
    } catch {
      toast.error('Could not delete the conversation')
    }
  }

  if (loading) {
    return <div className="py-6 flex justify-center"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
  }
  if (items.length === 0) {
    return <p className="px-3 py-2 text-[12px] text-gray-400">Your conversations will appear here.</p>
  }

  const groups: { label: string; items: Conversation[] }[] = []
  for (const c of items) {
    const label = groupLabel(new Date(c.updated_at))
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(c)
    else groups.push({ label, items: [c] })
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(g => (
        <div key={g.label}>
          <p className="px-3 pb-1 text-[11px] font-medium text-gray-400">{g.label}</p>
          <ul className="flex flex-col">
            {g.items.map(c => {
              const active = c.id === activeId
              return (
                <li key={c.id} className="group relative">
                  <button onClick={() => { onNavigate(); if (!active) navigate(`/chat/${c.id}`) }}
                          aria-current={active ? 'page' : undefined}
                          title={c.document_name ? `${c.title} — ${c.document_name}` : c.title}
                          className={`w-full text-left flex items-center gap-2 pl-3 pr-9 py-2 rounded-lg text-[13px] transition-colors
                            ${active ? 'bg-black/[0.06] text-gray-900 font-medium' : 'text-gray-700 hover:bg-black/[0.04]'}`}>
                    {c.document_id && <FileText size={13} className="flex-shrink-0 text-gray-400" />}
                    <span className="truncate">{c.title}</span>
                  </button>
                  <button onClick={() => remove(c)} aria-label={`Delete ${c.title}`} title="Delete"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-white
                                     sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                    <Trash2 size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, Check, Loader2 } from 'lucide-react'
import { createSubscriber, createLabel } from './actions'
import { LABEL_COLORS, COLOR_CLASSES, labelBadgeClass, type Label } from './labelColors'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

export default function AddSubscriberPanel({ existingLabels }: { existingLabels: Label[] }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selected, setSelected] = useState<Label[]>([])
  const [labels, setLabels] = useState<Label[]>(existingLabels)
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [newColor, setNewColor] = useState('blue')
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null)
  const [isPending, start] = useTransition()
  const dropRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = labels.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) && !selected.find(s => s.id === l.id)
  )
  const canCreate = query.trim() && !labels.find(l => l.name.toLowerCase() === query.trim().toLowerCase())

  const pickLabel = (l: Label) => { setSelected(p => [...p, l]); setQuery(''); setShowDrop(false) }
  const removeLabel = (id: string) => setSelected(p => p.filter(l => l.id !== id))

  const handleCreateLabel = () => {
    start(async () => {
      const result = await createLabel(query.trim(), newColor)
      if (result) { setLabels(p => [...p, result]); setSelected(p => [...p, result]); setQuery('') }
    })
  }

  const handleSubmit = () => {
    if (!phone.trim()) return
    start(async () => {
      const res = await createSubscriber({ name, phone, labelIds: selected.map(l => l.id) })
      if (res.type === 'error') {
        setStatus({ ok: false, msg: res.message || 'Failed' })
      } else if (res.type === 'duplicate') {
        setStatus({ ok: true, msg: `Existing subscriber merged. ${res.labelsAdded} new label(s) applied.` })
        setName(''); setPhone(''); setSelected([])
        router.refresh()
      } else {
        setStatus({ ok: true, msg: 'Subscriber added!' })
        setName(''); setPhone(''); setSelected([])
        router.refresh()
      }
    })
  }

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Add Subscriber</h2>
        <a href="/dashboard/subscribers" className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Name (optional)</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Phone Number *</label>
          <input className={inputCls} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210" />
        </div>
      </div>

      {/* Label multi-select */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">Labels</label>
        <div className="flex flex-wrap gap-1 min-h-[24px]">
          {selected.map(l => (
            <span key={l.id} className={labelBadgeClass(l.color)}>
              {l.name}
              <button onClick={() => removeLabel(l.id)} className="ml-1 hover:opacity-70">
                <X className="h-3 w-3 inline" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative" ref={dropRef}>
          <input className={inputCls} value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)}
            placeholder="Search or create label…"
          />
          {showDrop && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
              {filtered.map(l => (
                <button key={l.id} onMouseDown={() => pickLabel(l)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/60 transition-colors text-left">
                  <span className={`w-2 h-2 rounded-full ${COLOR_CLASSES[l.color]?.split(' ')[0] ?? ''} border`} />
                  <span className="text-sm text-foreground">{l.name}</span>
                </button>
              ))}
              {canCreate && (
                <div className="border-t border-border p-2 space-y-2">
                  <p className="text-xs text-muted-foreground px-1">Create <strong className="text-foreground">"{query}"</strong></p>
                  <div className="flex gap-1 flex-wrap px-1">
                    {LABEL_COLORS.map(c => (
                      <button key={c} onMouseDown={() => setNewColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ background: c === 'gold' ? '#F5A623' : undefined }}
                        title={c}
                      >
                        {c !== 'gold' && <span className={`block w-full h-full rounded-full ${COLOR_CLASSES[c]?.split(' ')[0]}`} />}
                      </button>
                    ))}
                  </div>
                  <button onMouseDown={handleCreateLabel} disabled={isPending}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium py-1.5 rounded-lg transition-colors">
                    <Plus className="h-3 w-3" />
                    Create label
                  </button>
                </div>
              )}
              {!filtered.length && !canCreate && (
                <p className="px-3 py-3 text-xs text-muted-foreground">No labels found</p>
              )}
            </div>
          )}
        </div>
      </div>

      {status && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${status.ok ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
          {status.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          {status.msg}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={!phone.trim() || isPending}
          className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add Subscriber
        </button>
      </div>
    </div>
  )
}

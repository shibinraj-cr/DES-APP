'use client'

import { useState, useEffect, useTransition, useRef, useCallback } from 'react'
import { useFormStatus } from 'react-dom'
import {
  Clock, Zap, X, Users, CalendarClock, Loader2, Send, Tag,
} from 'lucide-react'
import { sendBroadcast, getTargetedCount } from '../actions'
import { labelBadgeClass, COLOR_CLASSES, type Label } from '../../subscribers/labelColors'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

// ─── Label multi-select (reusable within this file) ──────────────
function LabelPicker({
  label, all, selected, onChange, exclude,
}: {
  label: string; all: Label[]; selected: Label[]; onChange: (l: Label[]) => void; exclude?: Label[]
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = all.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) &&
    !selected.find(s => s.id === l.id) &&
    !exclude?.find(e => e.id === l.id)
  )

  const pick = (l: Label) => { onChange([...selected, l]); setQuery(''); setOpen(false) }
  const remove = (id: string) => onChange(selected.filter(l => l.id !== id))

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(l => (
            <span key={l.id} className={labelBadgeClass(l.color) + ' flex items-center gap-0.5'}>
              {l.name}
              <button type="button" onClick={() => remove(l.id)} className="ml-0.5 hover:opacity-70">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative" ref={ref}>
        <input className={inputCls} value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={all.length ? 'Search labels…' : 'No labels yet'}
          disabled={all.length === 0}
        />
        {open && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-30 max-h-44 overflow-y-auto">
            {filtered.map(l => (
              <button key={l.id} type="button" onMouseDown={() => pick(l)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/60 text-left transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_CLASSES[l.color]?.split(' ')[0] ?? ''}`} />
                <span className="text-sm text-foreground">{l.name}</span>
              </button>
            ))}
          </div>
        )}
        {open && filtered.length === 0 && query && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-30 px-3 py-2 text-xs text-muted-foreground">
            No matching labels
          </div>
        )}
      </div>
    </div>
  )
}

function SendButton({ schedule }: { schedule: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}
      className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
      {pending
        ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
        : schedule
          ? <><CalendarClock className="h-4 w-4" /> Schedule Broadcast</>
          : <><Send className="h-4 w-4" /> Send Broadcast Now</>
      }
    </button>
  )
}

// ─── Main form ────────────────────────────────────────────────────
export default function NewBroadcastForm({
  allLabels,
  approvedTemplates,
  initialTotal,
}: {
  allLabels: Label[]
  approvedTemplates: { id: string; name: string }[]
  initialTotal: number
}) {
  const [mode, setMode] = useState<'24h' | 'anytime'>('24h')
  const [includeLabels, setIncludeLabels] = useState<Label[]>([])
  const [excludeLabels, setExcludeLabels] = useState<Label[]>([])
  const [assignLabelId, setAssignLabelId] = useState('')
  const [schedule, setSchedule] = useState(false)
  const [targetCount, setTargetCount] = useState<number | null>(initialTotal)
  const [countLoading, setCountLoading] = useState(false)
  const [, startCount] = useTransition()

  // Debounced live count refresh
  const refreshCount = useCallback(() => {
    setCountLoading(true)
    startCount(async () => {
      const n = await getTargetedCount(includeLabels.map(l => l.id), excludeLabels.map(l => l.id))
      setTargetCount(n)
      setCountLoading(false)
    })
  }, [includeLabels, excludeLabels])

  useEffect(() => {
    const t = setTimeout(refreshCount, 400)
    return () => clearTimeout(t)
  }, [refreshCount])

  return (
    <form action={sendBroadcast} className="space-y-5">
      {/* Hidden fields for label arrays */}
      {includeLabels.map(l => <input key={l.id} type="hidden" name="include_label_ids" value={l.id} />)}
      {excludeLabels.map(l => <input key={l.id} type="hidden" name="exclude_label_ids" value={l.id} />)}
      <input type="hidden" name="mode" value={mode} />
      {assignLabelId && <input type="hidden" name="assign_label_id" value={assignLabelId} />}

      {/* Campaign name */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">Campaign Name</label>
        <input name="name" required placeholder="e.g. April Promo" className={inputCls} />
      </div>

      {/* Message type toggle */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground/80">Message Type</p>
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button type="button" onClick={() => setMode('24h')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              mode === '24h'
                ? 'bg-primary text-primary-foreground'
                : 'bg-input text-muted-foreground hover:text-foreground'
            }`}>
            <Clock className="h-4 w-4 flex-shrink-0" />
            Text Message
          </button>
          <button type="button" onClick={() => setMode('anytime')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors border-l border-border ${
              mode === 'anytime'
                ? 'bg-primary text-primary-foreground'
                : 'bg-input text-muted-foreground hover:text-foreground'
            }`}>
            <Zap className="h-4 w-4 flex-shrink-0" />
            Template
          </button>
        </div>
        <p className={`text-[11px] px-1 ${mode === '24h' ? 'text-blue-400' : 'text-primary/80'}`}>
          {mode === '24h'
            ? '📩 Free text — only reaches contacts who messaged you in the last 24 hours.'
            : '⚡ Meta-approved template — reaches any contact at any time, even after 24 hours.'}
        </p>
      </div>

      {/* Text message input */}
      {mode === '24h' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Message</label>
          <textarea name="message" required rows={5} placeholder="Type your message here…"
            className={`${inputCls} resize-none`} />
          <p className="text-[11px] text-muted-foreground">Plain text. WhatsApp formats line breaks automatically.</p>
        </div>
      )}

      {/* Template selection */}
      {mode === 'anytime' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Select Template</label>
          {approvedTemplates.length > 0 ? (
            <select name="template_name" required className={inputCls}>
              <option value="">Choose an approved template…</option>
              {approvedTemplates.map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          ) : (
            <>
              <input name="template_name" required placeholder="Enter exact template name (e.g. welcome_msg)" className={inputCls} />
              <p className="text-[11px] text-amber-400">
                No approved templates found in your workspace. Go to <strong>Templates</strong> to add and get them approved first.
              </p>
            </>
          )}
        </div>
      )}

      {/* Audience */}
      <div className="space-y-3 pt-1">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Audience
        </p>
        <LabelPicker
          label="Include Labels (any of these)"
          all={allLabels}
          selected={includeLabels}
          onChange={setIncludeLabels}
          exclude={excludeLabels}
        />
        <LabelPicker
          label="Exclude Labels (none of these)"
          all={allLabels}
          selected={excludeLabels}
          onChange={setExcludeLabels}
          exclude={includeLabels}
        />
        {includeLabels.length === 0 && (
          <p className="text-[11px] text-muted-foreground">No include filter = all active subscribers are targeted.</p>
        )}
      </div>

      {/* Assign label after */}
      <div className="space-y-1.5 pt-1">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5" /> After Sending
        </p>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Assign Label to Recipients</label>
          <select
            value={assignLabelId}
            onChange={e => setAssignLabelId(e.target.value)}
            className={inputCls}
          >
            <option value="">None</option>
            {allLabels.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">This label will be added to all targeted contacts after sending.</p>
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> Send Time
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <div
            onClick={() => setSchedule(p => !p)}
            className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${schedule ? 'bg-primary' : 'bg-border'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${schedule ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm text-foreground">{schedule ? 'Schedule for later' : 'Send immediately'}</span>
        </label>
        {schedule && (() => {
          // Build min in IST (UTC+5:30) for the datetime-local input
          const pad = (n: number) => String(n).padStart(2, '0')
          const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000
          const minIST = new Date(Date.now() + IST_OFFSET_MS + 5 * 60 * 1000)
          const minStr = `${minIST.getUTCFullYear()}-${pad(minIST.getUTCMonth() + 1)}-${pad(minIST.getUTCDate())}T${pad(minIST.getUTCHours())}:${pad(minIST.getUTCMinutes())}`
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Date &amp; Time</label>
                <span className="text-[10px] text-primary/70 font-medium bg-primary/10 px-2 py-0.5 rounded-full">IST (UTC+5:30)</span>
              </div>
              <input type="datetime-local" name="scheduled_at"
                min={minStr}
                className={inputCls} required={schedule} />
              <p className="text-[11px] text-muted-foreground">Enter time in Indian Standard Time (IST).</p>
            </div>
          )
        })()}
      </div>

      {/* Live count */}
      <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-4 py-3">
        <Users className="h-4 w-4 text-primary flex-shrink-0" />
        {countLoading ? (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
          </span>
        ) : (
          <span className="text-sm">
            <strong className="text-primary">{(targetCount ?? 0).toLocaleString()}</strong>
            <span className="text-muted-foreground"> subscribers will be targeted</span>
          </span>
        )}
      </div>

      <SendButton schedule={schedule} />
    </form>
  )
}

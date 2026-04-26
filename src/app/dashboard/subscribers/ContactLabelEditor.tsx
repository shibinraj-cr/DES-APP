'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { updateContactLabels } from './actions'
import { COLOR_CLASSES, labelBadgeClass, type Label } from './labelColors'

interface Props {
  contactId: string
  initialLabels: Label[]
  allLabels: Label[]
}

export default function ContactLabelEditor({ contactId, initialLabels, allLabels }: Props) {
  const [selected, setSelected] = useState<Label[]>(initialLabels)
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [isPending, start] = useTransition()
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = allLabels.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) && !selected.find(s => s.id === l.id)
  )

  const pick = (l: Label) => {
    const next = [...selected, l]
    setSelected(next)
    setQuery('')
    setShowDrop(false)
    start(async () => { await updateContactLabels(contactId, next.map(x => x.id)) })
  }

  const remove = (id: string) => {
    const next = selected.filter(l => l.id !== id)
    setSelected(next)
    start(async () => { await updateContactLabels(contactId, next.map(x => x.id)) })
  }

  return (
    <div className="flex flex-wrap gap-1 items-center" ref={dropRef}>
      {selected.map(l => (
        <span key={l.id} className={labelBadgeClass(l.color) + ' flex items-center gap-0.5'}>
          {l.name}
          <button onClick={() => remove(l.id)} className="ml-0.5 hover:opacity-70" disabled={isPending}>
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          onClick={() => setShowDrop(p => !p)}
          disabled={isPending}
          className="w-5 h-5 rounded-full border border-dashed border-border hover:border-primary/60 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
        >
          {isPending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
        </button>

        {showDrop && (
          <div className="absolute top-full left-0 mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-30 max-h-48 overflow-y-auto">
            <div className="px-2 pt-2 pb-1">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-2 py-1 text-xs bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No labels</p>
            ) : (
              filtered.map(l => (
                <button
                  key={l.id}
                  onMouseDown={() => pick(l)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/60 transition-colors text-left"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_CLASSES[l.color]?.split(' ')[0] ?? ''}`} />
                  <span className="text-xs text-foreground">{l.name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

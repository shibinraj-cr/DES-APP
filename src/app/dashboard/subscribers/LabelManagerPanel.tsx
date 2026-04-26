'use client'

import { useState, useTransition } from 'react'
import { X, Plus, Pencil, Trash2, Check, Loader2 } from 'lucide-react'
import { createLabel, deleteLabel, renameLabel } from './actions'
import { LABEL_COLORS, COLOR_CLASSES, labelBadgeClass, type Label } from './labelColors'

export default function LabelManagerPanel({ existingLabels }: { existingLabels: Label[] }) {
  const [labels, setLabels] = useState<Label[]>(existingLabels)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('blue')
  const [isPending, start] = useTransition()

  const handleCreate = () => {
    if (!newName.trim()) return
    start(async () => {
      const result = await createLabel(newName.trim(), newColor)
      if (result) {
        setLabels(p => [...p, result])
        setNewName('')
        setNewColor('blue')
      }
    })
  }

  const startEdit = (l: Label) => {
    setEditingId(l.id)
    setEditName(l.name)
    setEditColor(l.color)
  }

  const handleRename = (id: string) => {
    if (!editName.trim()) return
    start(async () => {
      await renameLabel(id, editName.trim(), editColor)
      setLabels(p => p.map(l => l.id === id ? { ...l, name: editName.trim(), color: editColor } : l))
      setEditingId(null)
    })
  }

  const handleDelete = (id: string) => {
    start(async () => {
      await deleteLabel(id)
      setLabels(p => p.filter(l => l.id !== id))
    })
  }

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Manage Labels</h2>
        <a href="/dashboard/subscribers" className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </a>
      </div>

      {/* Create new label */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground/80">Create New Label</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Label name…"
            className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim() || isPending}
            className="px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg transition-colors flex items-center gap-1.5 text-sm"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {LABEL_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setNewColor(c)}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
            >
              <span className={`block w-full h-full rounded-full ${COLOR_CLASSES[c]?.split(' ')[0]}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Label list */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {labels.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">No labels yet. Create one above.</p>
        )}
        {labels.map(l => (
          <div key={l.id} className="flex items-center gap-2 group">
            {editingId === l.id ? (
              <>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(l.id); if (e.key === 'Escape') setEditingId(null) }}
                  autoFocus
                  className="flex-1 px-2.5 py-1.5 text-xs bg-input border border-primary rounded-lg text-foreground focus:outline-none"
                />
                <div className="flex gap-1">
                  {LABEL_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditColor(c)}
                      title={c}
                      className={`w-4 h-4 rounded-full border transition-all ${editColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    >
                      <span className={`block w-full h-full rounded-full ${COLOR_CLASSES[c]?.split(' ')[0]}`} />
                    </button>
                  ))}
                </div>
                <button onClick={() => handleRename(l.id)} disabled={isPending} className="text-green-400 hover:text-green-300">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className={labelBadgeClass(l.color)}>{l.name}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                  <button onClick={() => startEdit(l)} className="text-muted-foreground hover:text-foreground p-1">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(l.id)} disabled={isPending} className="text-muted-foreground hover:text-red-400 p-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

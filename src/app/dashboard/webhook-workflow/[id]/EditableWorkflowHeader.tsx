'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { updateWorkflow } from '../actions'

export default function EditableWorkflowHeader({
  id,
  initialName,
  initialTemplate,
}: {
  id: string
  initialName: string
  initialTemplate: string
}) {
  const [editing,  setEditing]  = useState(false)
  const [name,     setName]     = useState(initialName)
  const [template, setTemplate] = useState(initialTemplate)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    if (!name.trim() || !template.trim()) return
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id', id)
      fd.set('name', name.trim())
      fd.set('template_name', template.trim())
      await updateWorkflow(fd)
      setEditing(false)
    })
  }

  const handleCancel = () => {
    setName(initialName)
    setTemplate(initialTemplate)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex-1 min-w-0 flex items-center gap-2 group">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{name}</h1>
          <p className="text-xs text-muted-foreground">
            Template: <span className="font-mono text-primary/80">{template}</span>
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0"
          title="Edit name and template"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workflow name"
          autoFocus
          className="px-2 py-1 text-sm font-semibold bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
        />
        <input
          value={template}
          onChange={e => setTemplate(e.target.value)}
          placeholder="template_name"
          className="px-2 py-1 text-xs font-mono bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={isPending || !name.trim() || !template.trim()}
          className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-40 transition-colors"
          title="Save"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

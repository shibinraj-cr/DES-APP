'use client'

import { useState, useTransition } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { updateWorkflow } from './actions'

const inputCls = 'w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

export default function EditWorkflowInline({ id, name, templateName }: {
  id: string
  name: string
  templateName: string
}) {
  const [open, setOpen] = useState(false)
  const [editName, setEditName] = useState(name)
  const [editTemplate, setEditTemplate] = useState(templateName)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('name', editName.trim())
    fd.set('template_name', editTemplate.trim())
    startTransition(async () => {
      await updateWorkflow(fd)
      setOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Edit workflow"
        className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-primary"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Edit Workflow</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Template name</label>
            <input
              value={editTemplate}
              onChange={e => setEditTemplate(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || !editName.trim() || !editTemplate.trim()}
              className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/60 text-xs text-muted-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

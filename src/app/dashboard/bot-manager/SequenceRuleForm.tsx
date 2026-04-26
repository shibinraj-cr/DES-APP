'use client'

import { useState, useRef } from 'react'
import { Plus, Workflow, Webhook } from 'lucide-react'
import { createSequenceRule } from './actions'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

type Sequence = { id: string; name: string; description?: string | null }
type Workflow_ = { id: string; name: string }

export default function SequenceRuleForm({
  allSequences,
  allWorkflows,
}: {
  allSequences: Sequence[]
  allWorkflows: Workflow_[]
}) {
  const [triggerType, setTriggerType] = useState<'keyword' | 'after_webhook'>('keyword')
  const [delayUnit, setDelayUnit] = useState<'minutes' | 'hours'>('minutes')
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={createSequenceRule} className="space-y-4">
      {/* Sequence picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">Sequence</label>
        <select name="sequence_id" required className={inputCls}>
          <option value="">Select a sequence…</option>
          {allSequences.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.description ? ` — ${s.description}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Trigger type toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80">Trigger</label>
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            type="button"
            onClick={() => setTriggerType('keyword')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              triggerType === 'keyword'
                ? 'bg-primary text-primary-foreground'
                : 'bg-input text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="text-base leading-none">⌨</span>
            Keyword
          </button>
          <button
            type="button"
            onClick={() => setTriggerType('after_webhook')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border ${
              triggerType === 'after_webhook'
                ? 'bg-primary text-primary-foreground'
                : 'bg-input text-muted-foreground hover:text-foreground'
            }`}
          >
            <Webhook className="h-3.5 w-3.5" />
            After Webhook Send
          </button>
        </div>
        {/* Hidden input carries the selected type */}
        <input type="hidden" name="trigger_type" value={triggerType} />
      </div>

      {/* ── Keyword fields ── */}
      {triggerType === 'keyword' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80">Keyword</label>
          <input
            name="trigger_value"
            required
            placeholder="e.g. START, WELCOME, INFO"
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground">
            When a subscriber sends this exact word, the sequence starts immediately.
          </p>
        </div>
      )}

      {/* ── After Webhook Send fields ── */}
      {triggerType === 'after_webhook' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">Webhook Workflow</label>
            <select name="webhook_workflow_id" className={inputCls}>
              <option value="">Any webhook workflow</option>
              {allWorkflows.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Only fires when a <strong>new contact</strong> is created by the selected workflow.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground/80">Start sequence after</label>
            <div className="flex gap-2">
              <input
                name="delay_value"
                type="number"
                min="0"
                max="9999"
                defaultValue="0"
                placeholder="0"
                className="w-28 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={delayUnit}
                onChange={e => setDelayUnit(e.target.value as 'minutes' | 'hours')}
                className="flex-1 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
              <input type="hidden" name="delay_unit" value={delayUnit} />
            </div>
            <p className="text-xs text-muted-foreground">
              Set to <strong>0 minutes</strong> to start the sequence immediately after the webhook fires.
            </p>
          </div>
        </div>
      )}

      <button
        type="submit"
        className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5"
      >
        <Workflow className="h-3.5 w-3.5" />
        Activate Sequence
      </button>
    </form>
  )
}

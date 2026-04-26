'use client'

import { useState, useTransition } from 'react'
import {
  Copy, Check, RefreshCw, Plus, X, Loader2, Save,
  Clock, GitBranch, ChevronDown, ChevronUp, Tag, Workflow,
  FileSpreadsheet,
} from 'lucide-react'
import { saveWorkflowConfig, getLastPayload } from '../actions'

const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'
const selectCls = 'px-2 py-2 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary flex-shrink-0'

const OPERATORS = [
  { value: 'eq',          label: 'equals' },
  { value: 'neq',         label: 'not equals' },
  { value: 'contains',    label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'gt',          label: 'greater than' },
  { value: 'lt',          label: 'less than' },
]

const PHONE_FORMATTERS = [
  { value: 'none',      label: 'as-is' },
  { value: 'e164',      label: 'E.164 (add +)' },
  { value: 'prefix_91', label: 'Add +91 (India)' },
  { value: 'prefix_1',  label: 'Add +1 (US/CA)' },
]

const TEXT_FORMATTERS = [
  { value: 'none',       label: 'as-is' },
  { value: 'trim',       label: 'Trim spaces' },
  { value: 'capitalize', label: 'Title Case' },
  { value: 'uppercase',  label: 'UPPERCASE' },
  { value: 'lowercase',  label: 'lowercase' },
]

type Condition = { field: string; op: string; value: string }
type VarEntry  = { num: string; path: string; formatter: string }

function applyFormatterLocal(value: string, fmt: string): string {
  switch (fmt) {
    case 'e164':       return '+' + value.replace(/\D/g, '')
    case 'prefix_91':  return '+91' + value.replace(/\D/g, '')
    case 'prefix_1':   return '+1' + value.replace(/\D/g, '')
    case 'capitalize': return value.replace(/\b\w/g, c => c.toUpperCase())
    case 'uppercase':  return value.toUpperCase()
    case 'lowercase':  return value.toLowerCase()
    case 'trim':       return value.trim()
    default:           return value
  }
}

export default function WorkflowBuilder({
  workflow,
  webhookUrl,
  allLabels,
  allSequences,
}: {
  workflow: {
    id: string
    name: string
    template_name: string
    field_mapping: {
      phone?: string; name?: string
      vars?: Record<string, string>
      formatters?: Record<string, string>
    } | null
    delay_minutes: number
    conditions: Condition[]
    condition_mode: string
    last_payload: Record<string, unknown> | null
    post_send_actions: { tag_id?: string; sequence_id?: string } | null
  }
  webhookUrl: string
  allLabels: Array<{ id: string; name: string; color: string }>
  allSequences: Array<{ id: string; name: string }>
}) {
  const fm   = workflow.field_mapping ?? {}
  const fmts = fm.formatters ?? {}
  const psa  = workflow.post_send_actions ?? {}

  // Field mapping state
  const [phoneField,     setPhoneField]     = useState(fm.phone ?? '')
  const [phoneFormatter, setPhoneFormatter] = useState(fmts.phone ?? 'none')
  const [nameField,      setNameField]      = useState(fm.name ?? '')
  const [nameFormatter,  setNameFormatter]  = useState(fmts.name ?? 'none')
  const [vars, setVars] = useState<VarEntry[]>(
    Object.entries(fm.vars ?? {}).map(([num, path]) => ({ num, path, formatter: fmts[num] ?? 'none' }))
  )

  // Delay + conditions state
  const [delayMinutes,  setDelayMinutes]  = useState(workflow.delay_minutes ?? 0)
  const [conditions,    setConditions]    = useState<Condition[]>(workflow.conditions ?? [])
  const [conditionMode, setConditionMode] = useState(workflow.condition_mode ?? 'all')

  // Post-send actions state
  const [tagId,  setTagId]  = useState(psa.tag_id ?? '')
  const [seqId,  setSeqId]  = useState(psa.sequence_id ?? '')

  // UI state
  const [copied,          setCopied]          = useState(false)
  const [codeCopied,      setCodeCopied]      = useState(false)
  const [showConnection,  setShowConnection]  = useState(false)
  const [showGSheets,     setShowGSheets]     = useState(false)
  const [lastPayload,     setLastPayload]     = useState<Record<string, unknown> | null>(workflow.last_payload)
  const [saved,           setSaved]           = useState(false)

  const [isPending,    startTransition]  = useTransition()
  const [isRefreshing, startRefresh]    = useTransition()

  // ── Helpers ──────────────────────────────────────────────────
  const getFieldLocal = (path: string): string | undefined => {
    if (!lastPayload || !path.trim()) return undefined
    const val = path.split('.').reduce((obj: any, k) => obj?.[k], lastPayload)
    return val != null ? String(val) : undefined
  }

  const previewValue = (path: string, fmt: string) => {
    const raw = getFieldLocal(path)
    if (!raw) return undefined
    return fmt !== 'none' ? applyFormatterLocal(raw, fmt) : raw
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefreshPayload = () => {
    startRefresh(async () => {
      const fresh = await getLastPayload(workflow.id)
      setLastPayload(fresh)
    })
  }

  // ── Variable row helpers ───────────────────────────────────────
  const addVar = () => {
    const nextNum = String((vars.length > 0 ? Math.max(...vars.map(v => parseInt(v.num) || 0)) : 0) + 1)
    setVars([...vars, { num: nextNum, path: '', formatter: 'none' }])
  }
  const updateVar = (i: number, field: keyof VarEntry, val: string) =>
    setVars(vars.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
  const removeVar = (i: number) => setVars(vars.filter((_, idx) => idx !== i))

  // ── Condition helpers ──────────────────────────────────────────
  const addCondition = () => setConditions([...conditions, { field: '', op: 'eq', value: '' }])
  const updateCondition = (i: number, field: keyof Condition, val: string) =>
    setConditions(conditions.map((c, idx) => idx === i ? { ...c, [field]: val } : c))
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i))

  // ── Save ──────────────────────────────────────────────────────
  const handleSave = () => {
    const varsObj: Record<string, string> = {}
    const varFmts: Record<string, string> = {}
    vars.forEach(v => {
      if (v.num && v.path) {
        varsObj[v.num] = v.path
        if (v.formatter !== 'none') varFmts[v.num] = v.formatter
      }
    })
    const formatters: Record<string, string> = {}
    if (phoneFormatter !== 'none') formatters.phone = phoneFormatter
    if (nameFormatter  !== 'none') formatters.name  = nameFormatter
    Object.assign(formatters, varFmts)

    startTransition(async () => {
      await saveWorkflowConfig(workflow.id, {
        fieldMapping: {
          phone: phoneField, name: nameField, vars: varsObj,
          ...(Object.keys(formatters).length > 0 && { formatters }),
        },
        delayMinutes,
        conditions: conditions.filter(c => c.field && c.value),
        conditionMode,
        postSendActions: {
          ...(tagId && { tag_id: tagId }),
          ...(seqId && { sequence_id: seqId }),
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  // ── Google Sheets script ───────────────────────────────────────
  const gsheetsScript = `// ── Des App Webhook Integration ─────────────────────────
// 1. Open your Google Sheet
// 2. Go to Extensions → Apps Script
// 3. Replace any existing code with this script and save (Ctrl+S)
// 4. Click the clock icon (Triggers) → Add Trigger
//      Function: onchange | Event type: On change
// 5. Authorize and save. Test by inserting a new row.

function onchange(e) {
  var sheet = e.source.getActiveSheet();

  if (e.changeType === 'INSERT_ROW') {
    var lastRow = sheet.getLastRow();
    var rowData = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    sendToDesApp(lastRow, rowData);
  }

  if (e.changeType === 'EDIT') {
    var activeRow = sheet.getActiveRange().getRow();
    var rowData = sheet.getRange(activeRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (String(rowData[0]) !== '') sendToDesApp(activeRow, rowData);
  }
}

function sendToDesApp(rowNumber, rowData) {
  // Column A → _1, Column B → _2, Column C → _3 …
  var payload = { rowNumber: rowNumber };
  for (var i = 0; i < rowData.length; i++) {
    payload['_' + (i + 1)] = String(rowData[i] || '');
  }
  UrlFetchApp.fetch(
    "${webhookUrl}",
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );
}`

  const copyScript = async () => {
    await navigator.clipboard.writeText(gsheetsScript)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  // ── Sample payload preview ─────────────────────────────────────
  const buildSamplePayload = () => {
    const obj: Record<string, string> = {}
    if (phoneField) obj[phoneField.split('.').pop()!] = '+919876543210'
    if (nameField)  obj[nameField.split('.').pop()!]  = 'John Doe'
    vars.forEach(v => { if (v.path) obj[v.path.split('.').pop()!] = `value_${v.num}` })
    conditions.forEach(c => {
      const key = c.field.split('.').pop()!
      if (c.field && !obj[key]) obj[key] = c.value
    })
    return JSON.stringify(obj, null, 2)
  }

  return (
    <div className="space-y-5">

      {/* ── A. Connection & Webhook URL ──────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Webhook Callback URL</h2>
          <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2.5">
            <code className="text-xs text-foreground/80 flex-1 break-all">{webhookUrl}</code>
            <button onClick={copyUrl} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Connection Details toggle */}
            <button
              onClick={() => setShowConnection(p => !p)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Connection Details
              {showConnection ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Google Sheets toggle */}
            <button
              onClick={() => setShowGSheets(p => !p)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Google Sheets Setup
              {showGSheets ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Connection Details panel */}
        {showConnection && (
          <div className="border-t border-border bg-secondary/10 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground/80">Last received payload</p>
              <button
                onClick={handleRefreshPayload}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {lastPayload ? (
              <>
                <pre className="text-xs text-foreground/80 overflow-auto max-h-52 whitespace-pre-wrap bg-secondary/50 border border-border rounded-lg p-3 font-mono">
                  {JSON.stringify(lastPayload, null, 2)}
                </pre>
                <p className="text-[10px] text-muted-foreground">
                  Use the field names above (e.g. <code className="text-primary/80">mobile</code>, <code className="text-primary/80">_1</code>) in the mapping below.
                </p>
              </>
            ) : (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-3">
                <p className="text-xs text-amber-400">
                  No payload captured yet. Trigger this webhook once from your external system, then click Refresh to see the available field names.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Google Sheets Setup panel */}
        {showGSheets && (
          <div className="border-t border-border bg-secondary/10 p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="h-4 w-4 text-green-400" />
                <p className="text-sm font-semibold text-foreground">Google Sheets Integration</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically send a WhatsApp message whenever a new row is added to your Google Sheet.
              </p>
            </div>

            {/* Steps */}
            <ol className="space-y-2 text-xs text-muted-foreground list-none">
              {[
                'Open your Google Sheet',
                'Go to Extensions → Apps Script',
                'Replace any existing code with the script below and save (Ctrl+S)',
                'Click the clock icon (Triggers) → Add Trigger → Function: onchange | Event: On change',
                'Authorize and save. Test by inserting a new row.',
              ].map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            {/* Field mapping hint for GSheets */}
            <div className="bg-secondary/60 rounded-lg px-3 py-2.5 text-xs text-muted-foreground">
              The script sends columns as <code className="text-primary/80">_1</code> (col A), <code className="text-primary/80">_2</code> (col B), <code className="text-primary/80">_3</code> (col C)…
              In the mapping below, enter <code className="text-primary/80">_2</code> as the Phone field if column B contains the phone number.
            </div>

            {/* Script code */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Apps Script code</p>
                <button onClick={copyScript} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                  {codeCopied ? <><Check className="h-3.5 w-3.5 text-green-400" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy code</>}
                </button>
              </div>
              <pre className="text-[11px] text-foreground/75 font-mono bg-[#0d1117] border border-border rounded-lg p-4 overflow-x-auto leading-relaxed whitespace-pre">
                {gsheetsScript}
              </pre>
            </div>

            {/* Callback URL for verification */}
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Webhook URL used in script</p>
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 border border-border">
                <code className="text-[11px] text-green-400/90 flex-1 break-all font-mono">{webhookUrl}</code>
              </div>
              <p className="text-[10px] text-muted-foreground">Verify this matches the URL in your Apps Script before saving.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── B. Webhook Response Mapping ──────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Webhook Response Mapping
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Map your payload fields to phone, contact name, and template variables.
            Use dot notation for nested fields (e.g. <code className="text-primary/80">data.mobile</code>).
            For Google Sheets: <code className="text-primary/80">_1</code> = col A, <code className="text-primary/80">_2</code> = col B.
          </p>
        </div>

        {/* Phone field */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            📞 Phone Number <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <input
              value={phoneField}
              onChange={e => setPhoneField(e.target.value)}
              placeholder="e.g. mobile or _2"
              className={inputCls}
            />
            <select value={phoneFormatter} onChange={e => setPhoneFormatter(e.target.value)} className={selectCls} title="Phone formatter">
              {PHONE_FORMATTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {previewValue(phoneField, phoneFormatter) && (
            <p className="text-xs text-green-400 font-mono pl-1">→ {previewValue(phoneField, phoneFormatter)}</p>
          )}
        </div>

        {/* Name field */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground/80">
            👤 Contact Name <span className="text-muted-foreground">(optional)</span>
          </label>
          <div className="flex gap-2">
            <input
              value={nameField}
              onChange={e => setNameField(e.target.value)}
              placeholder="e.g. customer_name or _1"
              className={inputCls}
            />
            <select value={nameFormatter} onChange={e => setNameFormatter(e.target.value)} className={selectCls} title="Name formatter">
              {TEXT_FORMATTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {previewValue(nameField, nameFormatter) && (
            <p className="text-xs text-green-400 font-mono pl-1">→ {previewValue(nameField, nameFormatter)}</p>
          )}
        </div>

        {/* Template variables */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground/80">Template Variables</p>
          {vars.length === 0 && (
            <p className="text-xs text-muted-foreground">No variables — skip if your template has none.</p>
          )}
          {vars.map((v, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-12 flex-shrink-0 font-mono">{`{{${v.num}}}`}</span>
                <span className="text-xs text-muted-foreground">→</span>
                <input
                  value={v.path}
                  onChange={e => updateVar(i, 'path', e.target.value)}
                  placeholder="e.g. first_name or _3"
                  className={`${inputCls} flex-1`}
                />
                <select value={v.formatter} onChange={e => updateVar(i, 'formatter', e.target.value)} className={selectCls} title="Formatter">
                  {TEXT_FORMATTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <button onClick={() => removeVar(i)} className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {previewValue(v.path, v.formatter) && (
                <p className="text-xs text-green-400 font-mono pl-14">→ {previewValue(v.path, v.formatter)}</p>
              )}
            </div>
          ))}
          <button onClick={addVar} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Variable
          </button>
        </div>

        {/* Live sample payload */}
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Your system should send this JSON structure:</p>
          <pre className="text-xs text-foreground/80 font-mono">{buildSamplePayload()}</pre>
        </div>
      </div>

      {/* ── C. Send Delay ────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Send Delay
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Wait</span>
          <input
            type="number"
            min={0}
            max={10080}
            value={delayMinutes}
            onChange={e => setDelayMinutes(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-24 px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary text-center"
          />
          <span className="text-sm text-muted-foreground">minutes after webhook triggers</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Set to <strong>0</strong> to send immediately. Max 10,080 min (7 days).
          {delayMinutes >= 60 && (
            <span className="text-primary ml-1">
              ({delayMinutes >= 1440
                ? `${Math.floor(delayMinutes / 1440)}d ${Math.floor((delayMinutes % 1440) / 60)}h`
                : `${Math.floor(delayMinutes / 60)}h ${delayMinutes % 60}m`})
            </span>
          )}
        </p>
      </div>

      {/* ── D. Conditional Sending ───────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Conditional Sending</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Only send if the payload matches these rules. Leave empty to always send.</p>
        </div>

        {conditions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Send only if</span>
            <select
              value={conditionMode}
              onChange={e => setConditionMode(e.target.value)}
              className="px-2 py-1 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">ALL</option>
              <option value="any">ANY</option>
            </select>
            <span className="text-xs text-muted-foreground">of these rules match:</span>
          </div>
        )}

        <div className="space-y-2">
          {conditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={c.field}
                onChange={e => updateCondition(i, 'field', e.target.value)}
                placeholder="field (e.g. status or _5)"
                className="flex-1 px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <select
                value={c.op}
                onChange={e => updateCondition(i, 'op', e.target.value)}
                className="px-2 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
              >
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                value={c.value}
                onChange={e => updateCondition(i, 'value', e.target.value)}
                placeholder="value"
                className="flex-1 px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <button onClick={() => removeCondition(i)} className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addCondition} className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors">
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </button>
      </div>

      {/* ── E. Actions After Successful Send ─────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Actions After Successful Send</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically run these actions on the contact every time this workflow sends a message successfully.
          </p>
        </div>

        {/* Assign label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-primary" />
            Assign Label
          </label>
          <select
            value={tagId}
            onChange={e => setTagId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">— No label —</option>
            {allLabels.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {allLabels.length === 0 && (
            <p className="text-xs text-muted-foreground">No labels yet — create them in Subscribers → Labels.</p>
          )}
        </div>

        {/* Enroll in sequence */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5 text-primary" />
            Enroll in Sequence
          </label>
          <select
            value={seqId}
            onChange={e => setSeqId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">— No sequence —</option>
            {allSequences.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {allSequences.length === 0 && (
            <p className="text-xs text-muted-foreground">No sequences yet — create them in Bot Manager.</p>
          )}
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={isPending || !phoneField.trim()}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
      >
        {isPending
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          : saved
            ? <><Check className="h-4 w-4" /> Saved!</>
            : <><Save className="h-4 w-4" /> Save Configuration</>
        }
      </button>
    </div>
  )
}

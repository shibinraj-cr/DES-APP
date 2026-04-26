'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronLeft, Check, Type, Image, Video, FileText,
  Phone, ExternalLink, Copy, Zap, Plus, Trash2, Bold, Italic, Strikethrough,
  Variable, Send, RotateCcw, AlertCircle
} from 'lucide-react'
import WhatsAppPreview from './WhatsAppPreview'
import { saveTemplateDraft, submitTemplateToMeta } from './actions'

const STEPS = ['Metadata', 'Header', 'Body', 'Footer', 'Buttons', 'Submit']
const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const
const LANGUAGES = [
  { code: 'en_US', label: 'English (US)' }, { code: 'en_GB', label: 'English (UK)' },
  { code: 'ar', label: 'Arabic' }, { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' }, { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'fr', label: 'French' }, { code: 'de', label: 'German' },
  { code: 'id', label: 'Indonesian' }, { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' },
  { code: 'ms', label: 'Malay' }, { code: 'ru', label: 'Russian' },
  { code: 'th', label: 'Thai' }, { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' }, { code: 'ur', label: 'Urdu' },
  { code: 'bn', label: 'Bengali' }, { code: 'ta', label: 'Tamil' },
]
const HEADER_TYPES = [
  { value: 'NONE', label: 'None', icon: null },
  { value: 'TEXT', label: 'Text', icon: Type },
  { value: 'IMAGE', label: 'Image', icon: Image },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'DOCUMENT', label: 'Document', icon: FileText },
]
const BUTTON_TYPES = [
  { value: 'QUICK_REPLY', label: 'Quick Reply', icon: ChevronRight },
  { value: 'URL', label: 'Visit URL', icon: ExternalLink },
  { value: 'PHONE_NUMBER', label: 'Call Phone', icon: Phone },
  { value: 'COPY_CODE', label: 'Copy Code', icon: Copy },
  { value: 'FLOW', label: 'WhatsApp Flow', icon: Zap },
]

type ButtonDef = {
  type: 'QUICK_REPLY'; text: string
} | {
  type: 'URL'; text: string; url: string
} | {
  type: 'PHONE_NUMBER'; text: string; phone: string
} | {
  type: 'COPY_CODE'; code: string
} | {
  type: 'FLOW'; text: string; flowId: string
}

interface WizardForm {
  id?: string
  name: string
  category: typeof CATEGORIES[number]
  language: string
  headerType: string
  headerText: string
  headerMediaUrl: string
  headerFilename: string
  headerVarSample: string
  body: string
  bodyVarSamples: string[]
  footer: string
  buttons: ButtonDef[]
}

const defaultForm: WizardForm = {
  name: '', category: 'MARKETING', language: 'en_US',
  headerType: 'NONE', headerText: '', headerMediaUrl: '', headerFilename: '', headerVarSample: '',
  body: '', bodyVarSamples: [], footer: '', buttons: [],
}

function extractVarIndices(text: string): number[] {
  const nums = new Set<number>()
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) nums.add(parseInt(m[1]))
  return [...nums].sort((a, b) => a - b)
}

function toSnakeCase(s: string) {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

interface Props {
  initialData?: Partial<WizardForm>
  sequences?: { id: string; name: string }[]
}

export default function TemplateWizard({ initialData, sequences = [] }: Props) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardForm>({ ...defaultForm, ...initialData })
  const [error, setError] = useState('')
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'submitting' | 'done' | 'error'>('idle')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const set = useCallback(<K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm(f => ({ ...f, [key]: value }))
  }, [])

  const bodyVarIndices = extractVarIndices(form.body)
  const headerHasVar = form.headerType === 'TEXT' && form.headerText.includes('{{')

  const ensureSamples = (body: string) => {
    const indices = extractVarIndices(body)
    setForm(f => {
      const samples = [...f.bodyVarSamples]
      indices.forEach(i => { if (!samples[i - 1]) samples[i - 1] = '' })
      return { ...f, body, bodyVarSamples: samples }
    })
  }

  const insertBodyFormat = (tag: string) => {
    const ta = document.getElementById('body-textarea') as HTMLTextAreaElement
    if (!ta) return
    const { selectionStart: s, selectionEnd: e, value } = ta
    const selected = value.slice(s, e) || 'text'
    const wrapped = `${tag}${selected}${tag}`
    const next = value.slice(0, s) + wrapped + value.slice(e)
    ensureSamples(next)
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + tag.length, s + tag.length + selected.length) }, 0)
  }

  const addVar = () => {
    const next = bodyVarIndices.length ? Math.max(...bodyVarIndices) + 1 : 1
    const ta = document.getElementById('body-textarea') as HTMLTextAreaElement
    const tag = `{{${next}}}`
    if (ta) {
      const { selectionStart: s, value } = ta
      ensureSamples(value.slice(0, s) + tag + value.slice(s))
    } else {
      ensureSamples(form.body + tag)
    }
  }

  const addButton = (type: ButtonDef['type']) => {
    if (form.buttons.length >= 10) return
    let btn: ButtonDef
    if (type === 'QUICK_REPLY') btn = { type, text: '' }
    else if (type === 'URL') btn = { type, text: '', url: '' }
    else if (type === 'PHONE_NUMBER') btn = { type, text: '', phone: '' }
    else if (type === 'COPY_CODE') btn = { type, code: '' }
    else btn = { type, text: '', flowId: '' }
    set('buttons', [...form.buttons, btn])
  }

  const updateButton = (idx: number, patch: Partial<ButtonDef>) => {
    set('buttons', form.buttons.map((b, i) => i === idx ? { ...b, ...patch } as ButtonDef : b))
  }

  const removeButton = (idx: number) => {
    set('buttons', form.buttons.filter((_, i) => i !== idx))
  }

  const handleSaveAndSubmit = () => {
    setError('')
    setSubmitStatus('saving')
    startTransition(async () => {
      try {
        const result = await saveTemplateDraft({
          ...form,
          name: toSnakeCase(form.name),
        })
        setForm(f => ({ ...f, id: result.id, name: toSnakeCase(f.name) }))
        setSubmitStatus('submitting')
        await submitTemplateToMeta(result.id)
        setSubmitStatus('done')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'An error occurred')
        setSubmitStatus('error')
      }
    })
  }

  const handleSaveDraft = () => {
    setError('')
    setSubmitStatus('saving')
    startTransition(async () => {
      try {
        const result = await saveTemplateDraft({
          ...form,
          name: toSnakeCase(form.name),
        })
        setForm(f => ({ ...f, id: result.id }))
        setSubmitStatus('idle')
        router.push('/dashboard/templates')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'An error occurred')
        setSubmitStatus('error')
      }
    })
  }

  const canNext = () => {
    if (step === 0) return form.name.trim() !== '' && form.body !== undefined
    return true
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'
  const labelCls = 'block text-xs font-medium text-foreground/80 mb-1.5'

  return (
    <div className="flex gap-6 min-h-0">
      {/* Left: Wizard */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Step progress */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i === step ? 'bg-primary text-primary-foreground'
                  : i < step ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30'
                  : 'bg-secondary text-muted-foreground cursor-default'
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                {s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-card border border-border rounded-xl p-6 flex-1">
          {/* Step 0: Metadata */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Template Details</h2>
              <div>
                <label className={labelCls}>Template Name <span className="text-muted-foreground">(snake_case enforced)</span></label>
                <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. welcome_message" />
                {form.name && <p className="text-xs text-primary mt-1 font-mono">→ {toSnakeCase(form.name)}</p>}
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => set('category', c)}
                      className={`py-2.5 rounded-lg text-xs font-medium border transition-all ${
                        form.category === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Language</label>
                <select className={inputCls} value={form.language} onChange={e => set('language', e.target.value)}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Header */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Header <span className="text-muted-foreground font-normal">(optional)</span></h2>
              <div className="grid grid-cols-5 gap-2">
                {HEADER_TYPES.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => set('headerType', value)}
                    className={`py-3 rounded-lg text-xs font-medium border flex flex-col items-center gap-1.5 transition-all ${
                      form.headerType === value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {label}
                  </button>
                ))}
              </div>

              {form.headerType === 'TEXT' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Header Text</label>
                    <input className={inputCls} value={form.headerText}
                      onChange={e => set('headerText', e.target.value)}
                      placeholder="Enter header text, use {{1}} for variables"
                      maxLength={60}
                    />
                    <div className="flex justify-between mt-1">
                      {headerHasVar && <span className="text-xs text-muted-foreground">Variable detected</span>}
                      <span className="text-xs text-muted-foreground ml-auto">{form.headerText.length}/60</span>
                    </div>
                  </div>
                  {headerHasVar && (
                    <div>
                      <label className={labelCls}>Sample value for {'{{'}<span>1</span>{'}}'}  </label>
                      <input className={inputCls} value={form.headerVarSample}
                        onChange={e => set('headerVarSample', e.target.value)}
                        placeholder="Example value shown in preview"
                      />
                    </div>
                  )}
                </div>
              )}

              {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerType) && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Media URL</label>
                    <input className={inputCls} value={form.headerMediaUrl}
                      onChange={e => set('headerMediaUrl', e.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Paste a publicly accessible URL for the {form.headerType.toLowerCase()}</p>
                  </div>
                  {form.headerType === 'DOCUMENT' && (
                    <div>
                      <label className={labelCls}>Filename (optional)</label>
                      <input className={inputCls} value={form.headerFilename}
                        onChange={e => set('headerFilename', e.target.value)} placeholder="document.pdf" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Body */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Message Body</h2>
              <div>
                <label className={labelCls}>Body Text</label>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {[['*', <Bold key="b" className="h-3 w-3" />], ['_', <Italic key="i" className="h-3 w-3" />], ['~', <Strikethrough key="s" className="h-3 w-3" />]].map(([tag, icon]) => (
                    <button key={String(tag)} onClick={() => insertBodyFormat(String(tag))}
                      className="p-1.5 rounded border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors"
                      title={`Wrap selection with ${tag}`}
                    >{icon}</button>
                  ))}
                  <button onClick={addVar}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/40 text-muted-foreground hover:text-primary text-xs transition-colors"
                  >
                    <Variable className="h-3 w-3" />
                    Add {'{{'}{bodyVarIndices.length ? Math.max(...bodyVarIndices) + 1 : 1}{'}}'}
                  </button>
                </div>
                <textarea
                  id="body-textarea"
                  className={`${inputCls} resize-none`}
                  rows={6}
                  value={form.body}
                  onChange={e => ensureSamples(e.target.value)}
                  placeholder="Hi {{1}}, thanks for reaching out! Your order {{2}} is confirmed."
                  maxLength={1024}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    Formatting: *bold* _italic_ ~strikethrough~
                  </span>
                  <span className={`text-xs ${form.body.length > 900 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                    {form.body.length}/1024
                  </span>
                </div>
              </div>

              {bodyVarIndices.length > 0 && (
                <div>
                  <label className={labelCls}>Sample values for preview</label>
                  <div className="space-y-2">
                    {bodyVarIndices.map(n => (
                      <div key={n} className="flex items-center gap-2">
                        <span className="text-xs text-primary font-mono w-8 flex-shrink-0">{'{{'}{n}{'}}'}</span>
                        <input
                          className={inputCls}
                          value={form.bodyVarSamples[n - 1] || ''}
                          onChange={e => {
                            const s = [...form.bodyVarSamples]
                            s[n - 1] = e.target.value
                            set('bodyVarSamples', s)
                          }}
                          placeholder={`Sample for {{${n}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Footer */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Footer <span className="text-muted-foreground font-normal">(optional)</span></h2>
              <div>
                <label className={labelCls}>Footer Text</label>
                <input className={inputCls} value={form.footer}
                  onChange={e => set('footer', e.target.value.slice(0, 60))}
                  placeholder="Reply STOP to unsubscribe"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">{form.footer.length}/60 characters</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Footer appears below the body in smaller, lighter text. Common uses: opt-out instructions, legal disclaimers.</p>
              </div>
            </div>
          )}

          {/* Step 4: Buttons */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-sm font-semibold text-foreground">Buttons <span className="text-muted-foreground font-normal">(up to 10)</span></h2>

              {/* Add button */}
              <div>
                <label className={labelCls}>Add Button</label>
                <div className="flex flex-wrap gap-2">
                  {BUTTON_TYPES.map(({ value, label, icon: Icon }) => {
                    const count = form.buttons.filter(b => b.type === value).length
                    const maxed = value === 'QUICK_REPLY' ? count >= 3 : value === 'COPY_CODE' ? count >= 1 : false
                    return (
                      <button key={value}
                        onClick={() => !maxed && form.buttons.length < 10 && addButton(value as ButtonDef['type'])}
                        disabled={maxed || form.buttons.length >= 10}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Button list */}
              {form.buttons.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                  No buttons added. Buttons are optional.
                </div>
              )}

              <div className="space-y-3">
                {form.buttons.map((btn, idx) => (
                  <div key={idx} className="bg-secondary/30 rounded-lg p-3 flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-primary">{btn.type.replace(/_/g, ' ')}</span>
                      </div>

                      {(btn.type === 'QUICK_REPLY' || btn.type === 'URL' || btn.type === 'PHONE_NUMBER' || btn.type === 'FLOW') && (
                        <input className={inputCls} placeholder="Button label" value={btn.text || ''}
                          onChange={e => updateButton(idx, { text: e.target.value } as Partial<ButtonDef>)}
                          maxLength={25}
                        />
                      )}

                      {btn.type === 'URL' && (
                        <input className={inputCls} placeholder="https://example.com or https://example.com/{{1}}" value={btn.url}
                          onChange={e => updateButton(idx, { url: e.target.value } as Partial<ButtonDef>)}
                        />
                      )}
                      {btn.type === 'PHONE_NUMBER' && (
                        <input className={inputCls} placeholder="+1234567890" value={btn.phone}
                          onChange={e => updateButton(idx, { phone: e.target.value } as Partial<ButtonDef>)}
                        />
                      )}
                      {btn.type === 'COPY_CODE' && (
                        <input className={inputCls} placeholder="PROMO2024 or {{1}}" value={btn.code}
                          onChange={e => updateButton(idx, { code: e.target.value } as Partial<ButtonDef>)}
                        />
                      )}
                      {btn.type === 'FLOW' && (
                        <input className={inputCls} placeholder="WhatsApp Flow ID" value={btn.flowId}
                          onChange={e => updateButton(idx, { flowId: e.target.value } as Partial<ButtonDef>)}
                        />
                      )}

                      {btn.type === 'QUICK_REPLY' && sequences.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground flex-shrink-0">Connect to sequence:</span>
                          <select className={`${inputCls} flex-1`} defaultValue="">
                            <option value="">None</option>
                            {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeButton(idx)} className="p-1 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Submit */}
          {step === 5 && (
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-foreground">Review & Submit to Meta</h2>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Name', value: toSnakeCase(form.name) || '—' },
                  { label: 'Category', value: form.category },
                  { label: 'Language', value: LANGUAGES.find(l => l.code === form.language)?.label || form.language },
                  { label: 'Header', value: form.headerType === 'NONE' ? 'None' : form.headerType },
                  { label: 'Buttons', value: form.buttons.length.toString() },
                  { label: 'Footer', value: form.footer ? 'Yes' : 'None' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-400/10 border border-red-400/30 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {submitStatus === 'done' && (
                <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-lg p-3">
                  <Check className="h-4 w-4 text-green-400" />
                  <p className="text-sm text-green-400">Template submitted! Meta will review it within 24 hours.</p>
                </div>
              )}

              {/* Status timeline */}
              <div className="flex items-center gap-2">
                {['Draft', 'Pending Review', 'Approved / Rejected'].map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      i === 0 ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {i === 0 && <Check className="h-3 w-3" />}
                      {s}
                    </div>
                    {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={handleSaveDraft} disabled={isPending}
                  className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm font-medium hover:border-primary/40 disabled:opacity-50 transition-colors"
                >
                  {submitStatus === 'saving' && !isPending ? <RotateCcw className="h-4 w-4 mx-auto animate-spin" /> : 'Save as Draft'}
                </button>
                <button onClick={handleSaveAndSubmit} disabled={isPending || submitStatus === 'done' || !form.name.trim() || !form.body.trim()}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {isPending ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitStatus === 'submitting' ? 'Submitting to Meta…' : submitStatus === 'saving' ? 'Saving…' : 'Submit to Meta'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        {step < 5 && (
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 disabled:opacity-30 transition-all"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <button onClick={() => canNext() && setStep(s => Math.min(5, s + 1))} disabled={!canNext()}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-40 transition-all"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Right: Live Preview */}
      <div className="w-72 flex-shrink-0 sticky top-6 self-start">
        <WhatsAppPreview
          headerType={form.headerType}
          headerText={form.headerType === 'TEXT' ? form.headerText.replace('{{1}}', form.headerVarSample || '{{1}}') : ''}
          headerMediaUrl={form.headerMediaUrl}
          body={form.body}
          bodyVarSamples={form.bodyVarSamples}
          footer={form.footer}
          buttons={form.buttons as Parameters<typeof WhatsAppPreview>[0]['buttons']}
        />
      </div>
    </div>
  )
}

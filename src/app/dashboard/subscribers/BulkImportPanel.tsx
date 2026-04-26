'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, FileText, AlertCircle, Download, Loader2, Tags } from 'lucide-react'
import { bulkImportSubscribers } from './actions'
import { COLOR_CLASSES, labelBadgeClass, type Label } from './labelColors'

interface ParsedRow { name: string; phone: string }

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return { rows: [], errors: ['File must have a header row and at least one data row'] }

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, '').trim())
  const nameIdx = header.findIndex(h => h === 'name' || h === 'full name' || h.includes('name'))
  const phoneIdx = header.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('number'))

  if (phoneIdx === -1) return { rows: [], errors: ['Could not find a phone/mobile column in header'] }

  const rows: ParsedRow[] = []
  const errors: string[] = []

  lines.slice(1).forEach((line, i) => {
    const cols = parseCSVLine(line)
    const phone = cols[phoneIdx]?.replace(/['"]/g, '').trim()
    if (!phone) { errors.push(`Row ${i + 2}: missing phone number`); return }
    const name = nameIdx >= 0 ? cols[nameIdx]?.replace(/['"]/g, '').trim() : ''
    rows.push({ name, phone })
  })

  return { rows, errors }
}

export default function BulkImportPanel({ existingLabels }: { existingLabels: Label[] }) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<Label[]>([])
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null)
  const [isPending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = existingLabels.filter(l =>
    l.name.toLowerCase().includes(query.toLowerCase()) && !selectedLabels.find(s => s.id === l.id)
  )

  const pickLabel = (l: Label) => { setSelectedLabels(p => [...p, l]); setQuery(''); setShowDrop(false) }
  const removeLabel = (id: string) => setSelectedLabels(p => p.filter(l => l.id !== id))

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const { rows: parsed, errors } = parseCSV(text)
      setRows(parsed)
      setParseErrors(errors)
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    start(async () => {
      const res = await bulkImportSubscribers(rows, selectedLabels.map(l => l.id))
      setResult(res)
      router.refresh()
    })
  }

  const downloadSample = () => {
    const csv = ['name,phone', 'John Doe,+919876543210', 'Jane Smith,+918765432109', 'Rahul Kumar,+917654321098'].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'subscribers_sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Bulk Upload Subscribers</h2>
        <a href="/dashboard/subscribers" className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </a>
      </div>

      {/* Format guide */}
      <div className="bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground/80">CSV Format</p>
          <button onClick={downloadSample} className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors">
            <Download className="h-3 w-3" />
            Download Sample
          </button>
        </div>
        <p>Required: <code className="text-primary">phone</code> column. Optional: <code className="text-primary">name</code></p>
        <p className="font-mono bg-secondary/60 px-2 py-1 rounded">name,phone<br/>John Doe,+919876543210<br/>Jane,+918765432109</p>
      </div>

      {/* Label picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
          <Tags className="h-3.5 w-3.5 text-muted-foreground" />
          Apply Labels to All Imported Contacts
        </label>
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedLabels.map(l => (
              <span key={l.id} className={labelBadgeClass(l.color) + ' flex items-center gap-0.5'}>
                {l.name}
                <button onClick={() => removeLabel(l.id)} className="ml-0.5 hover:opacity-70">
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="relative" ref={dropRef}>
          <input
            className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)}
            placeholder={existingLabels.length ? 'Search labels to apply…' : 'No labels yet — create one in Labels panel'}
            disabled={existingLabels.length === 0}
          />
          {showDrop && filtered.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 max-h-44 overflow-y-auto">
              {filtered.map(l => (
                <button key={l.id} onMouseDown={() => pickLabel(l)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/60 transition-colors text-left">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_CLASSES[l.color]?.split(' ')[0] ?? ''}`} />
                  <span className="text-sm text-foreground">{l.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File input */}
      <div>
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors group">
          <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {fileName || 'Click to select CSV file'}
          </p>
        </button>
      </div>

      {/* Parse errors */}
      {parseErrors.length > 0 && (
        <div className="space-y-1">
          {parseErrors.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground/80">
              <span className="text-primary">{rows.length}</span> subscribers found — preview (first 5):
            </p>
            {selectedLabels.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Labels: {selectedLabels.map(l => (
                  <span key={l.id} className={labelBadgeClass(l.color) + ' mr-1'}>{l.name}</span>
                ))}
              </p>
            )}
          </div>
          <div className="bg-secondary/30 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 text-muted-foreground">Phone</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-1.5 text-foreground">{r.name || <em className="text-muted-foreground">—</em>}</td>
                    <td className="px-3 py-1.5 font-mono text-foreground">{r.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">Duplicates (same phone number) will be merged — existing labels kept, new labels added.</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Created', value: result.created, color: 'text-green-400' },
            { label: 'Merged', value: result.updated, color: 'text-blue-400' },
            { label: 'Skipped', value: result.skipped, color: 'text-muted-foreground' },
            { label: 'Errors', value: result.errors, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-secondary/40 rounded-lg p-2 text-center">
              <p className={`text-lg font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && !result && (
        <button onClick={handleImport} disabled={isPending}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Import {rows.length} Subscribers{selectedLabels.length > 0 ? ` with ${selectedLabels.length} label${selectedLabels.length > 1 ? 's' : ''}` : ''}
        </button>
      )}
    </div>
  )
}

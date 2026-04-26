'use client'

import { useState } from 'react'
import { Send, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const inputCls = 'w-full px-2.5 py-1.5 text-xs bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary'

export default function TestSendButton({ workflowId, secretToken }: {
  workflowId: string
  secretToken: string
}) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSend = async () => {
    if (!phone.trim()) return
    setStatus('sending')
    try {
      const res = await fetch(`/api/workflow/${workflowId}?token=${secretToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('ok')
        setTimeout(() => { setOpen(false); setStatus('idle'); setPhone('') }, 2000)
      } else {
        setStatus('error')
        setErrorMsg(data.error || data.reason || 'Failed to send')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Network error')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); setStatus('idle'); setErrorMsg('') }}
        title="Test send"
        className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
      >
        <Send className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Test Send</p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="+919876543210"
            className={inputCls}
          />

          {status === 'ok' && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Sent successfully!
            </p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {errorMsg}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={status === 'sending' || !phone.trim()}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            {status === 'sending'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Send className="h-3.5 w-3.5" />}
            {status === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { Image as ImageIcon, Video, FileText, Phone, ExternalLink, Copy, Zap } from 'lucide-react'

interface Button {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE' | 'FLOW'
  text?: string
  url?: string
  phone?: string
  code?: string
  flowId?: string
}

interface PreviewProps {
  headerType: string
  headerText: string
  headerMediaUrl: string
  body: string
  bodyVarSamples: string[]
  footer: string
  buttons: Button[]
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderWhatsApp(raw: string, samples: string[]): string {
  const withVars = raw.replace(/\{\{(\d+)\}\}/g, (_, n) => {
    const val = samples[parseInt(n) - 1]
    return val ? escapeHtml(val) : `<span class="opacity-50">{{${n}}}</span>`
  })
  return escapeHtml(withVars)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/~([^~\n]+)~/g, '<del>$1</del>')
    .replace(/\n/g, '<br/>')
}

const MEDIA_ICONS: Record<string, { icon: React.FC<{ className?: string }>, label: string, color: string }> = {
  IMAGE: { icon: ImageIcon, label: 'Image', color: 'bg-blue-500/20 text-blue-400' },
  VIDEO: { icon: Video, label: 'Video', color: 'bg-purple-500/20 text-purple-400' },
  DOCUMENT: { icon: FileText, label: 'Document', color: 'bg-orange-500/20 text-orange-400' },
}

const BUTTON_ICONS: Record<string, React.FC<{ className?: string }>> = {
  URL: ExternalLink,
  PHONE_NUMBER: Phone,
  COPY_CODE: Copy,
  FLOW: Zap,
}

export default function WhatsAppPreview({ headerType, headerText, headerMediaUrl, body, bodyVarSamples, footer, buttons }: PreviewProps) {
  const hasContent = headerType !== 'NONE' || body || footer || buttons.length > 0
  const quickReplies = buttons.filter(b => b.type === 'QUICK_REPLY')
  const ctaButtons = buttons.filter(b => b.type !== 'QUICK_REPLY')

  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="w-[280px] bg-[#111B21] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Status bar */}
        <div className="bg-[#1F2C34] px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] text-white/60">9:41</span>
          <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>

        {/* WhatsApp top bar */}
        <div className="bg-[#202C33] px-3 py-2.5 flex items-center gap-2.5 border-b border-white/5">
          <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">B</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium">Business Name</p>
            <p className="text-[10px] text-white/40">WhatsApp Business ✓</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="min-h-[300px] p-3 space-y-2" style={{ background: 'linear-gradient(180deg, #0B141A 0%, #0D1B22 100%)' }}>
          {!hasContent ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-white/20 text-xs text-center">Your template preview<br/>will appear here</p>
            </div>
          ) : (
            <div className="max-w-[85%]">
              {/* Message bubble */}
              <div className="bg-[#202C33] rounded-lg rounded-tl-none overflow-hidden shadow-sm">
                {/* Header */}
                {headerType === 'TEXT' && headerText && (
                  <div className="px-3 pt-2.5 pb-1">
                    <p className="text-white text-xs font-semibold leading-snug">{headerText}</p>
                  </div>
                )}
                {headerType !== 'NONE' && headerType !== 'TEXT' && (() => {
                  const media = MEDIA_ICONS[headerType]
                  if (!media) return null
                  const Icon = media.icon
                  return (
                    <div className={`mx-3 mt-2.5 mb-1 h-24 rounded-lg ${media.color} flex flex-col items-center justify-center gap-1`}>
                      <Icon className="h-6 w-6" />
                      <span className="text-[10px] font-medium">{media.label}</span>
                      {headerMediaUrl && <span className="text-[9px] opacity-60 truncate max-w-[90%]">{headerMediaUrl.split('/').pop()}</span>}
                    </div>
                  )
                })()}

                {/* Body */}
                {body && (
                  <div className="px-3 py-2">
                    <p
                      className="text-[#E9EDEF] text-[11px] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderWhatsApp(body, bodyVarSamples) }}
                    />
                  </div>
                )}

                {/* Footer */}
                {footer && (
                  <div className="px-3 pb-2">
                    <p className="text-[#8696A0] text-[10px]">{footer}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="px-3 pb-1.5 flex justify-end">
                  <span className="text-[9px] text-[#8696A0]">12:00 PM ✓✓</span>
                </div>

                {/* CTA buttons */}
                {ctaButtons.length > 0 && (
                  <div className="border-t border-[#2A3942]">
                    {ctaButtons.map((btn, i) => {
                      const Icon = BUTTON_ICONS[btn.type]
                      return (
                        <div key={i} className="flex items-center justify-center gap-1.5 py-2 border-b border-[#2A3942] last:border-0">
                          {Icon && <Icon className="h-3 w-3 text-[#00A884]" />}
                          <span className="text-[#00A884] text-[11px]">{btn.text || 'Button'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Quick reply buttons (outside bubble) */}
              {quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {quickReplies.map((btn, i) => (
                    <div key={i} className="bg-[#202C33] rounded-full px-3 py-1 border border-[#2A3942]">
                      <span className="text-[#00A884] text-[10px] font-medium">{btn.text || 'Reply'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3 text-center opacity-60">Live preview</p>
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Plus, RefreshCw, Send, Trash2, AlertCircle, CheckCircle, Clock, XCircle, Edit } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { refreshTemplateStatus, deleteTemplate, submitTemplateFormAction } from './actions'

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  draft:    { icon: Edit,         color: 'text-muted-foreground', bg: 'bg-secondary',       label: 'Draft' },
  pending:  { icon: Clock,        color: 'text-orange-400',       bg: 'bg-orange-400/15',   label: 'Pending Review' },
  approved: { icon: CheckCircle,  color: 'text-green-400',        bg: 'bg-green-400/15',    label: 'Approved' },
  rejected: { icon: XCircle,      color: 'text-red-400',          bg: 'bg-red-400/15',      label: 'Rejected' },
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: { status?: string; category?: string; error?: string; success?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  let query = supabase
    .from('templates')
    .select('id, name, category, language, status, rejection_reason, meta_template_id, header_type, updated_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })

  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.category) query = query.eq('category', searchParams.category)

  const { data: templates } = await query

  const counts = {
    all: templates?.length ?? 0,
    draft: templates?.filter(t => t.status === 'draft').length ?? 0,
    pending: templates?.filter(t => t.status === 'pending').length ?? 0,
    approved: templates?.filter(t => t.status === 'approved').length ?? 0,
    rejected: templates?.filter(t => t.status === 'rejected').length ?? 0,
  }

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Template Manager</h1>
          <p className="text-xs text-muted-foreground">Create and manage WhatsApp Business message templates</p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="ml-auto flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Template
        </Link>
      </div>

      <div className="p-6 space-y-5">
        {searchParams.error && (
          <div className="flex items-start gap-2 bg-red-400/10 border border-red-400/30 rounded-lg px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{searchParams.error}</p>
          </div>
        )}
        {searchParams.success && (
          <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-lg px-4 py-3">
            <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-400">{searchParams.success}</p>
          </div>
        )}
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: '', label: 'All', count: counts.all },
            { key: 'draft', label: 'Draft', count: counts.draft },
            { key: 'pending', label: 'Pending', count: counts.pending },
            { key: 'approved', label: 'Approved', count: counts.approved },
            { key: 'rejected', label: 'Rejected', count: counts.rejected },
          ].map(({ key, label, count }) => (
            <Link
              key={key}
              href={key ? `/dashboard/templates?status=${key}` : '/dashboard/templates'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                (searchParams.status || '') === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                (searchParams.status || '') === key ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>{count}</span>
            </Link>
          ))}
        </div>

        {/* Templates table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {!templates?.length ? (
            <div className="py-16 text-center">
              <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-1">
                {searchParams.status ? `No ${searchParams.status} templates` : 'No templates yet'}
              </p>
              <Link href="/dashboard/templates/new"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2">
                <Plus className="h-3 w-3" /> Create your first template
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Language</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Updated</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {templates.map((t: any) => {
                  const status = t.status || 'draft'
                  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
                  const StatusIcon = cfg.icon
                  return (
                    <tr key={t.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground font-mono text-sm">{t.name}</p>
                        {t.rejection_reason && (
                          <div className="flex items-start gap-1 mt-1">
                            <AlertCircle className="h-3 w-3 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400 line-clamp-2">{t.rejection_reason}</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.category}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{t.language}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {formatDistanceToNow(new Date(t.updated_at || t.created_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/templates/new?edit=${t.id}`} title="Edit"
                            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-primary transition-colors">
                            <Edit className="h-3.5 w-3.5" />
                          </Link>
                          {(status === 'draft' || status === 'rejected') && (
                            <form action={submitTemplateFormAction}>
                              <input type="hidden" name="templateId" value={t.id} />
                              <button type="submit" title="Submit to Meta"
                                className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-green-400 transition-colors">
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                          {status === 'pending' && (
                            <form action={refreshTemplateStatus.bind(null, t.id)}>
                              <button type="submit" title="Refresh status"
                                className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-primary transition-colors">
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          )}
                          <form action={deleteTemplate.bind(null, t.id)}>
                            <button type="submit" title="Delete"
                              className="p-1.5 rounded-lg hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

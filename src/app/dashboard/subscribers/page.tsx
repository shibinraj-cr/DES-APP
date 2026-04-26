import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserX, Upload, Plus, Tags, Search, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AddSubscriberPanel from './AddSubscriberPanel'
import BulkImportPanel from './BulkImportPanel'
import LabelManagerPanel from './LabelManagerPanel'
import ContactLabelEditor from './ContactLabelEditor'
import { labelBadgeClass } from './labelColors'
import { deleteSubscriber, optOutSubscriber, optInSubscriber } from './actions'

type Panel = 'add' | 'import' | 'labels' | null
type Tab = 'all' | 'optedout'

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: { q?: string; label?: string; panel?: string; tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1)
  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) redirect('/onboarding')

  const panel = (searchParams.panel ?? null) as Panel
  const tab: Tab = searchParams.tab === 'optedout' ? 'optedout' : 'all'
  const q = searchParams.q ?? ''
  const labelFilter = searchParams.label ?? ''

  // Fetch all labels for this workspace
  const { data: allLabels } = await supabase
    .from('contact_tags')
    .select('id, name, color')
    .eq('workspace_id', workspaceId)
    .order('name')
  const labels = allLabels ?? []

  // Get contact IDs filtered by label if needed
  let labelContactIds: string[] | null = null
  if (labelFilter) {
    const { data: mapped } = await supabase
      .from('contact_tag_mapping').select('contact_id').eq('tag_id', labelFilter)
    labelContactIds = (mapped ?? []).map((r: any) => r.contact_id)
    if (labelContactIds.length === 0) labelContactIds = ['__none__']
  }

  // Base contact query
  let contactQuery = supabase
    .from('contacts')
    .select('id, name, phone_number, opted_out, opted_out_at, created_at, contact_tag_mapping(contact_tags(id, name, color))')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  contactQuery = contactQuery.eq('opted_out', tab === 'optedout')

  if (q) {
    contactQuery = contactQuery.or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`)
  }
  if (labelContactIds) {
    contactQuery = contactQuery.in('id', labelContactIds)
  }

  const { data: contacts } = await contactQuery
  const rows = contacts ?? []

  // Counts for tabs
  const { count: allCount } = await supabase
    .from('contacts').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('opted_out', false)
  const { count: optedOutCount } = await supabase
    .from('contacts').select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).eq('opted_out', true)

  const selectedLabel = labels.find(l => l.id === labelFilter)

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0 flex items-center justify-between gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Subscribers</h1>
          <p className="text-xs text-muted-foreground">
            {(allCount ?? 0).toLocaleString()} active · {(optedOutCount ?? 0).toLocaleString()} opted out
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/dashboard/subscribers?panel=labels${tab === 'optedout' ? '&tab=optedout' : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              panel === 'labels'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            <Tags className="h-3.5 w-3.5" />
            Labels
          </a>
          <a
            href={`/dashboard/subscribers?panel=import${tab === 'optedout' ? '&tab=optedout' : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              panel === 'import'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            Bulk Upload
          </a>
          <a
            href={`/dashboard/subscribers?panel=add${tab === 'optedout' ? '&tab=optedout' : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              panel === 'add'
                ? 'bg-primary/15 border-primary text-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </a>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Panel */}
          {panel === 'add' && <AddSubscriberPanel existingLabels={labels} />}
          {panel === 'import' && <BulkImportPanel existingLabels={labels} />}
          {panel === 'labels' && <LabelManagerPanel existingLabels={labels} />}

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border">
            <a
              href={`/dashboard/subscribers?${q ? `q=${encodeURIComponent(q)}&` : ''}${labelFilter ? `label=${labelFilter}&` : ''}${panel ? `panel=${panel}&` : ''}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                tab === 'all'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Active
              <span className="text-xs bg-secondary px-1.5 py-0.5 rounded-full">{(allCount ?? 0).toLocaleString()}</span>
            </a>
            <a
              href={`/dashboard/subscribers?tab=optedout${q ? `&q=${encodeURIComponent(q)}` : ''}${panel ? `&panel=${panel}` : ''}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2 ${
                tab === 'optedout'
                  ? 'border-red-400 text-red-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <UserX className="h-3.5 w-3.5" />
              Opted Out
              {(optedOutCount ?? 0) > 0 && (
                <span className="text-xs bg-red-400/15 text-red-400 px-1.5 py-0.5 rounded-full">{optedOutCount}</span>
              )}
            </a>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 items-center">
            <form method="get" action="/dashboard/subscribers" className="flex-1 min-w-[200px] relative">
              {panel && <input type="hidden" name="panel" value={panel} />}
              {tab === 'optedout' && <input type="hidden" name="tab" value="optedout" />}
              {labelFilter && <input type="hidden" name="label" value={labelFilter} />}
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search by name or phone…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </form>

            {/* Label filter chips */}
            {labels.length > 0 && tab === 'all' && (
              <div className="flex flex-wrap gap-1.5 items-center">
                {labels.map(l => (
                  <a
                    key={l.id}
                    href={`/dashboard/subscribers?${q ? `q=${encodeURIComponent(q)}&` : ''}${panel ? `panel=${panel}&` : ''}label=${l.id === labelFilter ? '' : l.id}`}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      labelFilter === l.id
                        ? 'border-primary bg-primary/15 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {l.name}
                  </a>
                ))}
                {labelFilter && (
                  <a
                    href={`/dashboard/subscribers?${q ? `q=${encodeURIComponent(q)}&` : ''}${panel ? `panel=${panel}` : ''}`}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5"
                  >
                    <X className="h-3 w-3" /> Clear
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Active filter info */}
          {(q || selectedLabel) && (
            <p className="text-xs text-muted-foreground">
              Showing {rows.length} result{rows.length !== 1 ? 's' : ''}
              {q && <> matching <strong className="text-foreground">"{q}"</strong></>}
              {selectedLabel && <> in label <strong className="text-foreground">{selectedLabel.name}</strong></>}
            </p>
          )}

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {rows.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                {tab === 'optedout'
                  ? <><UserX className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />No opted-out subscribers</>
                  : <><Users className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />No subscribers found</>
                }
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Labels</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Added</th>
                    <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {rows.map((c: any) => {
                    const contactLabels = (c.contact_tag_mapping ?? [])
                      .map((m: any) => m.contact_tags)
                      .filter(Boolean)
                    return (
                      <tr key={c.id} className="hover:bg-secondary/20 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
                              c.opted_out
                                ? 'bg-red-400/10 border-red-400/30'
                                : 'bg-primary/15 border-primary/20'
                            }`}>
                              <span className={`font-bold text-xs ${c.opted_out ? 'text-red-400' : 'text-primary'}`}>
                                {(c.name || c.phone_number || '?')[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground leading-tight">{c.name || <em className="text-muted-foreground not-italic">—</em>}</p>
                              {c.opted_out && (
                                <span className="text-[10px] text-red-400 font-medium">OPTED OUT</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.phone_number}</td>
                        <td className="px-4 py-3">
                          <ContactLabelEditor
                            contactId={c.id}
                            initialLabels={contactLabels}
                            allLabels={labels}
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {c.opted_out ? (
                              <form action={optInSubscriber}>
                                <input type="hidden" name="id" value={c.id} />
                                <button type="submit" className="text-xs px-2 py-1 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 transition-colors font-medium">
                                  Opt In
                                </button>
                              </form>
                            ) : (
                              <form action={optOutSubscriber}>
                                <input type="hidden" name="id" value={c.id} />
                                <button type="submit" className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors font-medium">
                                  Opt Out
                                </button>
                              </form>
                            )}
                            <form action={deleteSubscriber}>
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-red-400/15 text-muted-foreground hover:text-red-400 transition-colors font-medium">
                                Delete
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
    </div>
  )
}

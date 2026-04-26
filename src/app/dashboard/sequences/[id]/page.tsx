import { createClient } from '@/utils/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SequenceCanvas from './SequenceCanvas'
import Link from 'next/link'
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import { toggleSequence } from '../actions'

export default async function SequenceBuilderPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: seq } = await supabase
    .from('bot_sequences')
    .select('id, name, is_active, flow_data')
    .eq('id', params.id)
    .single()

  if (!seq) notFound()

  const flowData = seq.flow_data as { nodes: unknown[]; edges: unknown[] } ?? { nodes: [], edges: [] }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 flex-shrink-0" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <Link href="/dashboard/sequences" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">{seq.name}</h1>
          <p className="text-[10px] text-muted-foreground">Sequence Builder — click a node to configure it</p>
        </div>
        <form action={toggleSequence} className="flex items-center gap-2">
          <input type="hidden" name="id" value={seq.id} />
          <input type="hidden" name="is_active" value={String(seq.is_active)} />
          <button type="submit" className="flex items-center gap-1.5 text-xs">
            {seq.is_active
              ? <><ToggleRight className="h-5 w-5 text-primary" /><span className="text-primary font-medium">Active</span></>
              : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-muted-foreground">Paused</span></>
            }
          </button>
        </form>
      </div>

      {/* Canvas fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <SequenceCanvas
          sequenceId={seq.id}
          initialFlow={flowData as any}
          sequenceName={seq.name}
        />
      </div>
    </div>
  )
}

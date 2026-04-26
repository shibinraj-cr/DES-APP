import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { createSequence } from '../actions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import SubmitButton from './SubmitButton'

export default async function NewSequencePage({ searchParams }: { searchParams: { error?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="px-6 py-4 border-b border-border flex items-center gap-4" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <Link href="/dashboard/sequences" className="text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">New Sequence</h1>
          <p className="text-xs text-muted-foreground">Name your flow — assign its trigger in Bot Manager</p>
        </div>
      </div>

      <div className="p-6 max-w-md">
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          {searchParams.error && (
            <div className="bg-red-400/10 border border-red-400/30 text-red-400 text-sm px-4 py-3 rounded-lg">
              {decodeURIComponent(searchParams.error)}
            </div>
          )}

          <form action={createSequence} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Sequence Name</label>
              <input name="name" required placeholder="e.g. Welcome Flow"
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/80">Description <span className="text-muted-foreground">(optional)</span></label>
              <input name="description" placeholder="What does this sequence do?"
                className="w-full px-3 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2.5 text-xs text-primary/80">
              After building the flow, go to <strong>Bot Manager → Sequences</strong> to assign a trigger and activate it.
            </div>
            <SubmitButton />
          </form>
        </div>
      </div>
    </div>
  )
}

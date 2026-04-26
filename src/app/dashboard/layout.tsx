import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logout } from './actions'
import SidebarNav from './SidebarNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex flex-col flex-shrink-0 border-r border-border" style={{ background: 'oklch(0.13 0.010 255)' }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b border-border flex items-center gap-2.5">
          <Image
            src="/desapp-logo.png"
            alt="Des App"
            width={36}
            height={36}
            className="object-contain rounded-lg flex-shrink-0"
            priority
          />
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">
              Des<span className="text-primary">App</span>
            </p>
            <p className="text-[9px] text-muted-foreground/60 tracking-widest uppercase leading-tight">Messaging CRM</p>
          </div>
        </div>

        <SidebarNav />

        {/* Divider with gold accent */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

        {/* User / Logout */}
        <div className="px-3 py-4 space-y-1">
          <div className="px-3 py-2">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <form action={logout}>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>

        {/* Bottom tagline */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] text-muted-foreground/50 text-center tracking-widest uppercase">
            Convert Conversations Into Clients
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-background">
        {children}
      </main>
    </div>
  )
}

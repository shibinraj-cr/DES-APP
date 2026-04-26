'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, MessageSquare, Users, Radio, Bot, Webhook, FileText, Workflow, UserCog, Settings } from 'lucide-react'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/conversations', label: 'Shared Inbox', icon: MessageSquare },
  { href: '/dashboard/subscribers', label: 'Subscribers', icon: Users },
  { href: '/dashboard/broadcasting', label: 'Broadcasting', icon: Radio },
  { href: '/dashboard/bot-manager', label: 'Bot Manager', icon: Bot },
  { href: '/dashboard/sequences', label: 'Bot Sequences', icon: Workflow },
  { href: '/dashboard/webhook-workflow', label: 'Webhook Workflow', icon: Webhook },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/users', label: 'User Manager', icon: UserCog },
  { href: '/dashboard/settings/whatsapp', label: 'Settings', icon: Settings },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navLinks.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'text-primary bg-primary/10 border border-primary/20'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent'
            }`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

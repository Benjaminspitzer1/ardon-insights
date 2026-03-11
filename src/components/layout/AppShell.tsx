import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Briefcase, FileText, BarChart3, Settings,
  ChevronLeft, ChevronRight, LogOut, User,
  Newspaper, TrendingUp, Moon, Sun, DollarSign, Landmark, Receipt,
  FolderOpen, Inbox
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import LiveRateBanner from '@/components/LiveRateBanner'
import ChatWidget from '@/components/ChatWidget'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/portfolios', icon: FolderOpen, label: 'My Portfolio' },
      { href: '/documents', icon: FileText, label: 'Documents' },
    ],
  },
  {
    label: 'Properties',
    items: [
      { href: '/properties', icon: Building2, label: 'Properties' },
      { href: '/deal-flow', icon: Briefcase, label: 'Deals' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { href: '/cash-flow', icon: DollarSign, label: 'Cash Flow' },
      { href: '/financing', icon: Landmark, label: 'Financing' },
      { href: '/operating-expenses', icon: Receipt, label: 'Operating Expenses' },
    ],
  },
  {
    label: 'Market',
    items: [
      { href: '/market-research', icon: BarChart3, label: 'Market Data' },
      { href: '/news', icon: Newspaper, label: 'News' },
    ],
  },
  {
    label: 'Other',
    items: [
      { href: '/deal-inbox', icon: Inbox, label: 'Deal Inbox' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('theme') === 'dark'
  })
  const location = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [dark])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? ''

  function isActive(href: string) {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r border-border bg-card transition-all duration-300',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          {/* Logo */}
          <div className={cn('flex h-16 items-center border-b border-border px-4', collapsed ? 'justify-center' : 'gap-3')}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal">
              <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                <path d="M10 3L17 16H12.5L10 11L7.5 16H3L10 3Z" fill="white" opacity="0.9"/>
                <path d="M7 13H13" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            {!collapsed && (
              <div>
                <p className="text-sm font-bold tracking-widest text-foreground">ARDON</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Insights</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-2 space-y-4">
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                {/* Section header — only show when expanded */}
                {!collapsed && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(({ href, icon: Icon, label }) => {
                    const active = isActive(href)
                    return (
                      <Tooltip key={href}>
                        <TooltipTrigger asChild>
                          <Link
                            to={href}
                            className={cn(
                              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                              active
                                ? 'bg-brand-teal/15 text-brand-teal-light'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                              collapsed && 'justify-center px-0'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && label}
                          </Link>
                        </TooltipTrigger>
                        {collapsed && <TooltipContent side="right">{label}</TooltipContent>}
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* User + collapse */}
          <div className="border-t border-border p-2 space-y-1">
            {!collapsed && (
              <div className="flex items-center gap-2 rounded-md px-3 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-purple/20">
                  <User className="h-4 w-4 text-brand-purple-light" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{user?.email}</p>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn('w-full justify-start gap-3 text-muted-foreground hover:text-foreground', collapsed && 'justify-center px-0')}
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!collapsed && 'Sign out'}
                </Button>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">Sign out</TooltipContent>}
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              className={cn('w-full justify-start gap-3 text-muted-foreground hover:text-foreground', collapsed && 'justify-center px-0')}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <><ChevronLeft className="h-4 w-4 shrink-0" />Collapse</>}
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header bar */}
          <header className="flex h-12 items-center justify-between border-b border-border bg-card px-6">
            <div />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple/20 text-xs font-semibold text-brand-purple-light">
                {avatarLetter || <User className="h-4 w-4" />}
              </div>
            </div>
          </header>
          <LiveRateBanner />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
      <ChatWidget />
    </TooltipProvider>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { User, Bell, Shield, Database, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { href: '/settings', label: 'Profile', icon: User, exact: true },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/security', label: 'Security', icon: Shield },
  { href: '/settings/integrations', label: 'Integrations', icon: Database },
]

function SettingsNav() {
  const location = useLocation()
  return (
    <nav className="space-y-1 w-48 shrink-0">
      {SETTINGS_NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? location.pathname === href : location.pathname.startsWith(href) && href !== '/settings'
        return (
          <Link
            key={href}
            to={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-brand-teal/15 text-brand-teal-light' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

function ProfileSettings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [fullName, setFullName] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      if (data) setFullName(data.full_name ?? '')
      return data
    },
    enabled: !!user,
  })

  const save = useMutation({
    mutationFn: async () => {
      await supabase.from('profiles').upsert({ id: user!.id, email: user!.email!, full_name: fullName, role: profile?.role ?? 'analyst' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your account information</p>
      </div>
      <Separator />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={profile?.role ?? 'analyst'} disabled />
          </div>
        </CardContent>
      </Card>
      <Button variant="brand" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )
}

function IntegrationsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground">Connect external services to ARDON Insights</p>
      </div>
      <Separator />
      {[
        { name: 'Gmail', description: 'Receive and process deal emails from Gmail', status: 'not connected' },
        { name: 'Microsoft Outlook', description: 'Receive and process deal emails from Outlook', status: 'not connected' },
        { name: 'Google Maps', description: '3D property maps and neighborhood intelligence', status: 'configured' },
        { name: 'FRED API', description: 'Live market rate data from Federal Reserve', status: 'configured' },
        { name: 'Bright Data', description: 'Premium web scraping proxy for market data', status: 'not configured' },
      ].map(({ name, description, status }) => (
        <Card key={name}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-xs', status === 'configured' ? 'text-emerald-400' : 'text-muted-foreground')}>
                {status}
              </span>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChangePassword = async () => {
    setErrorMsg('')
    setStatus('idle')
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.')
      return
    }
    setStatus('saving')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('success')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Change Password</h2>
        <p className="text-sm text-muted-foreground">Update your password to keep your account secure.</p>
      </div>
      <Separator />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
          {status === 'success' && <p className="text-sm text-emerald-400">Password updated successfully.</p>}
        </CardContent>
      </Card>
      <Button variant="brand" onClick={handleChangePassword} disabled={status === 'saving'}>
        {status === 'saving' ? 'Updating...' : 'Change Password'}
      </Button>
    </div>
  )
}

function NotificationsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">Email delivery and notification preferences</p>
      </div>
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirmation Emails</CardTitle>
          <CardDescription>
            Emails sent when users sign up, reset passwords, or confirm their account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-2">
            <p>
              <span className="font-medium">Current sender:</span>{' '}
              <span className="text-muted-foreground">noreply@mail.supabase.io (Supabase default)</span>
            </p>
            <p className="text-muted-foreground">
              To send confirmation emails from <span className="font-medium text-foreground">ARDON Insights</span> with
              your own domain and sender name, configure a custom SMTP server in the Supabase dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <a
              href="https://supabase.com/dashboard/project/otolaopaqpeljpfhdkhm/auth/smtp"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
            >
              Configure SMTP in Supabase
            </a>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Recommended providers: Resend, AWS SES, SendGrid, Postmark. Set the sender name to{' '}
            <span className="font-mono">ARDON Insights</span> when configuring.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </div>
      <div className="flex gap-8">
        <SettingsNav />
        <div className="flex-1">
          <Routes>
            <Route index element={<ProfileSettings />} />
            <Route path="notifications" element={<NotificationsSettings />} />
            <Route path="security" element={<SecuritySettings />} />
            <Route path="integrations" element={<IntegrationsSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

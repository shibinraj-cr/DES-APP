import { saveWhatsAppSettings, disconnectWhatsApp } from './actions'
import { CopyButton } from './CopyButton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Settings, ShieldCheck, Wifi, WifiOff, Link2 } from 'lucide-react'

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string; update?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)

  const workspaceId = members?.[0]?.workspace_id
  if (!workspaceId) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertDescription>You do not belong to any workspace. Please go through onboarding.</AlertDescription>
        </Alert>
      </div>
    )
  }

  // Check existing connection (don't fetch encrypted token)
  const { data: existing } = await supabase
    .from('whatsapp_accounts')
    .select('phone_number_id, waba_id, updated_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const headersList = headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'your-domain.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const webhookUrl = `${protocol}://${host}/api/webhooks/whatsapp`
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || ''

  const isConnected = !!existing
  const showUpdateForm = !isConnected || searchParams.update === '1'

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-border flex items-center gap-3"
        style={{ background: 'oklch(0.13 0.010 255)' }}
      >
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">WhatsApp Integration</h2>
        {isConnected && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Connected
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Alerts */}
          {searchParams.error && (
            <Alert variant="destructive">
              <AlertDescription>{searchParams.error}</AlertDescription>
            </Alert>
          )}
          {searchParams.success && (
            <Alert className="bg-green-500/10 border-green-500/30 text-green-400">
              <AlertDescription>{searchParams.success}</AlertDescription>
            </Alert>
          )}

          {/* Connected account card */}
          {isConnected && (
            <div className="bg-card border border-green-500/20 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
              <div className="h-1 bg-gradient-to-r from-green-500/40 via-green-500 to-green-500/40" />
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
                    <Wifi className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">WhatsApp Connected</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Last updated {new Date(existing.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <form action={disconnectWhatsApp} className="ml-auto">
                    <input type="hidden" name="workspace_id" value={workspaceId} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <WifiOff className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </form>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Phone Number ID</p>
                    <p className="text-sm font-mono text-foreground truncate">{existing.phone_number_id}</p>
                  </div>
                  <div className="bg-secondary/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">WABA ID</p>
                    <p className="text-sm font-mono text-foreground truncate">{existing.waba_id}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <a
                    href="?update=1"
                    className="text-xs text-primary/70 hover:text-primary underline underline-offset-2"
                  >
                    Update credentials
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Credentials form — shown when not connected or update=1 */}
          {showUpdateForm && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
              <div className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              <div className="p-6">
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {isConnected ? 'Update Credentials' : 'Connect WhatsApp Business'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {isConnected
                        ? 'Enter new credentials to replace the existing ones.'
                        : 'Enter your Meta App credentials. Tokens are encrypted at rest.'}
                    </p>
                  </div>
                </div>

                <form action={saveWhatsAppSettings} className="flex flex-col gap-5">
                  <input type="hidden" name="workspace_id" value={workspaceId} />

                  <div className="space-y-1.5">
                    <Label htmlFor="phone_number_id" className="text-foreground/80 text-sm">Phone Number ID</Label>
                    <Input
                      id="phone_number_id"
                      name="phone_number_id"
                      required
                      defaultValue={existing?.phone_number_id ?? ''}
                      placeholder="64115028574786"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Found in Meta App Dashboard → WhatsApp → API Setup</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="waba_id" className="text-foreground/80 text-sm">WhatsApp Business Account ID</Label>
                    <Input
                      id="waba_id"
                      name="waba_id"
                      required
                      defaultValue={existing?.waba_id ?? ''}
                      placeholder="1267509371484132"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="access_token" className="text-foreground/80 text-sm">Permanent Access Token</Label>
                    <Input
                      id="access_token"
                      name="access_token"
                      type="password"
                      required
                      placeholder={isConnected ? 'Enter new token to replace the existing one' : 'EAALxxxxxxx...'}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Generate a system user token with{' '}
                      <code className="text-primary/80">whatsapp_business_messaging</code> and{' '}
                      <code className="text-primary/80">whatsapp_business_management</code> permissions
                    </p>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                    >
                      {isConnected ? 'Update Credentials' : 'Save & Encrypt Credentials'}
                    </Button>
                    {isConnected && (
                      <a
                        href="/dashboard/settings/whatsapp"
                        className="flex items-center px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      >
                        Cancel
                      </a>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Webhook config — always visible */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            <div className="h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            <div className="p-6">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                  <Link2 className="h-5 w-5 text-primary/70" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Webhook Configuration</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Set these in your Meta App → WhatsApp → Configuration</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Callback URL</p>
                  <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                    <p className="text-sm text-foreground font-mono flex-1 break-all">{webhookUrl}</p>
                    <CopyButton text={webhookUrl} />
                  </div>
                </div>
                {verifyToken && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Verify Token</p>
                    <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2">
                      <p className="text-sm text-foreground font-mono flex-1">{verifyToken}</p>
                      <CopyButton text={verifyToken} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

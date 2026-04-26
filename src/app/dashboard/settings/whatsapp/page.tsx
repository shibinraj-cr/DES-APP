import { saveWhatsAppSettings } from './actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Settings, ShieldCheck } from 'lucide-react'

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string }
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div
        className="px-6 py-4 border-b border-border flex items-center gap-3"
        style={{ background: 'oklch(0.13 0.010 255)' }}
      >
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">WhatsApp Integration</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {/* Credentials Card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            {/* Card top accent */}
            <div className="h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Meta App Credentials</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Connect your WhatsApp Business API. Tokens are encrypted at rest.
                  </p>
                </div>
              </div>

              <form action={saveWhatsAppSettings} className="flex flex-col gap-5">
                <input type="hidden" name="workspace_id" value={workspaceId} />

                {searchParams.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{searchParams.error}</AlertDescription>
                  </Alert>
                )}
                {searchParams.success && (
                  <Alert className="bg-primary/10 border-primary/30 text-primary">
                    <AlertDescription>{searchParams.success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="phone_number_id" className="text-foreground/80 text-sm">Phone Number ID</Label>
                  <Input
                    id="phone_number_id"
                    name="phone_number_id"
                    required
                    placeholder="104xxxxxxx..."
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
                    placeholder="105xxxxxxx..."
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
                    placeholder="EAALxxxxxxx..."
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Generate a system user token with <code className="text-primary/80">whatsapp_business_messaging</code> and{' '}
                    <code className="text-primary/80">whatsapp_business_management</code> permissions
                  </p>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20"
                  >
                    Save & Encrypt Credentials
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Webhook info card */}
          <div className="mt-4 bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Webhook Configuration</p>
            <p className="text-sm text-foreground font-mono bg-secondary/50 rounded-lg px-3 py-2 break-all">
              https://your-domain.com/api/webhooks/whatsapp
            </p>
            <p className="text-xs text-muted-foreground mt-2">Set this URL in your Meta App webhook settings with your <code className="text-primary/80">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code></p>
          </div>
        </div>
      </div>
    </div>
  )
}

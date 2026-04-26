import { createOrganization } from './actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'

export default function OnboardingPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background hex-grid-bg p-4">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/desapp-logo.png" alt="Des App" width={80} height={80} className="object-contain" priority />
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h2 className="text-xl font-semibold text-foreground mb-1">Set Up Your Workspace</h2>
          <p className="text-sm text-muted-foreground mb-6">Create your organization to get started</p>

          <form action={createOrganization} className="flex flex-col gap-4">
            {searchParams.error && (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="org_name" className="text-foreground/80">Organization Name</Label>
              <Input
                id="org_name"
                name="org_name"
                required
                placeholder="Acme Corp"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="workspace_name" className="text-foreground/80">Workspace Name</Label>
              <Input
                id="workspace_name"
                name="workspace_name"
                required
                placeholder="Sales Team"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
              />
            </div>
            <Button
              type="submit"
              className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Complete Setup
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6 tracking-widest uppercase">
          Convert Conversations Into Clients
        </p>
      </div>
    </div>
  )
}

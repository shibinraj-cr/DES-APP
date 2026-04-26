import { login, signup } from './actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Image from 'next/image'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background hex-grid-bg p-4">
      {/* Glow effect behind card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/desapp-logo.png"
            alt="Des App"
            width={80}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/50">
          <h2 className="text-xl font-semibold text-foreground mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to your workspace</p>

          <form className="flex flex-col gap-4">
            {searchParams.error && (
              <Alert variant="destructive">
                <AlertDescription>{searchParams.error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground/80">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-foreground/80">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="bg-input border-border text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <Button
                type="submit"
                formAction={login}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              >
                Sign In
              </Button>
              <Button
                type="submit"
                formAction={signup}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-secondary hover:text-foreground"
              >
                Create Account
              </Button>
            </div>
          </form>
        </div>

        {/* Tagline */}
        <p className="text-center text-xs text-muted-foreground mt-6 tracking-widest uppercase">
          Convert Conversations Into Clients
        </p>
      </div>
    </div>
  )
}

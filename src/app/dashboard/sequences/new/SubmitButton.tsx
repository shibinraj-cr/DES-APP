'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

export default function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'Creating…' : 'Create & Open Builder →'}
    </button>
  )
}

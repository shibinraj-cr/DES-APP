'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = createClient()
  const { email, password } = Object.fromEntries(formData.entries())
  
  const { error } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = createClient()
  const { email, password } = Object.fromEntries(formData.entries())

  const { error } = await supabase.auth.signUp({
    email: email as string,
    password: password as string,
  })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  redirect('/onboarding')
}

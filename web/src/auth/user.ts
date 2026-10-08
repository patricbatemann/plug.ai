import { useEffect, useState } from 'react'
import { authApi, type User } from '../api/client'

export interface Profile {
  email: string
  name: string
  initials: string
}

// One lookup per page load; signing out reloads the page.
let pending: Promise<User> | null = null

/** The signed-in user, named from their email (raj.anand@… → Raj Anand, RA). Null until known. */
export function useProfile(): Profile | null {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    pending ??= authApi.me()
    pending.then(setUser, () => {
      pending = null
    })
  }, [])
  if (!user) return null
  const parts = user.email.split('@')[0].split(/[._-]+/).filter(Boolean)
  const name = parts.map((part) => part[0].toUpperCase() + part.slice(1)).join(' ')
  const initials = (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase()
  return { email: user.email, name, initials }
}

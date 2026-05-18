import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

// Mirror of admin/login route's portal profile. Kept here so the request
// routes don't have to import from another route handler.
const PORTAL_PROFILE: Record<'tim' | 'jess', { name: string; email: string }> = {
  tim: { name: 'Tim', email: 'tim.legallo@ogilvy.com' },
  jess: { name: 'Jess', email: 'jessica.coccaro@ogilvy.com' },
}

type PortalKey = 'tim' | 'jess'

function readPortal(request: NextRequest): PortalKey {
  const raw = request.cookies.get(ADMIN_PORTAL_COOKIE)?.value
  return raw === 'jess' ? 'jess' : 'tim'
}

// Look up (and auto-create if missing) the User row for an admin portal,
// so admins can file their own time-off requests with their own email.
export async function getOrCreatePortalUser(request: NextRequest) {
  const portal = readPortal(request)
  const profile = PORTAL_PROFILE[portal]

  const existing = await db.user.findUnique({ where: { email: profile.email } })
  if (existing) return existing

  const placeholderHash = await hashPassword(`portal-${portal}-${Date.now()}`)
  return db.user.create({
    data: {
      email: profile.email,
      name: profile.name,
      passwordHash: placeholderHash,
      accountType: 'PRODUCER',
    },
  })
}

interface SessionLike {
  userId: string
  isAdmin?: boolean
}

// For request endpoints: returns the User the request should belong to.
// Regular users → themselves. Admin portal users → Tim/Jess as appropriate.
export async function resolveSubmitterUser(request: NextRequest, session: SessionLike) {
  if (session.isAdmin) {
    return getOrCreatePortalUser(request)
  }
  return db.user.findUnique({ where: { id: session.userId } })
}

import { NextRequest, NextResponse } from 'next/server'
import { createSession, getSessionFromCookie, COOKIE_NAME } from '@/lib/session'

// POST /api/admin/elevate
//
// Tim (or Jess, or Isaac) is already signed in as a regular user on the
// dashboard. This turns that login into the admin session — the same
// cookie the "Tim Login" password path sets — so the "Review all
// submissions" button works without a second password. Gated on the
// signed-in email, nothing else.
const ADMIN_PORTAL_COOKIE = 'admin_portal_user'
const ELEVATE: Record<string, 'tim' | 'jess'> = {
  'tim.legallo@ogilvy.com': 'tim',
  'jessica.coccaro@ogilvy.com': 'jess',
  'isaac.boruchowicz@ogilvy.com': 'tim',
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookie(request.headers.get('cookie'))
    const email = (session?.email ?? '').toLowerCase()
    const portal = ELEVATE[email]
    if (!session || !portal) return NextResponse.json({ error: 'not_allowed' }, { status: 403 })
    const token = await createSession(session.userId, session.email, true)
    const response = NextResponse.json({ ok: true, portal })
    const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 7, path: '/' }
    response.cookies.set(COOKIE_NAME, token, cookie)
    response.cookies.set(ADMIN_PORTAL_COOKIE, portal, cookie)
    return response
  } catch (error) {
    console.error('Elevate error:', error)
    return NextResponse.json({ error: 'Failed to elevate' }, { status: 500 })
  }
}

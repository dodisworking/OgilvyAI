import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'
import { resolveSubmitterUser } from '@/lib/portalUser'

// GET /api/notify-recipients/recent
// Returns the recipients the current user has notified in the past, deduped
// by email (case-insensitive) and ordered most-recent-first. Lets the
// notify picker remember the last group instead of forcing re-entry every time.
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin sessions resolve to the portal owner so Tim/Jess see their own
    // history, not the admin sentinel.
    const user = await resolveSubmitterUser(request, session)
    if (!user) {
      return NextResponse.json({ recipients: [] })
    }

    const requests = await db.request.findMany({
      where: {
        userId: user.id,
        notifyEmails: { not: undefined },
      },
      select: { notifyEmails: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const seen = new Map<string, { email: string; name?: string; lastUsedAt: string }>()
    for (const r of requests) {
      const raw = r.notifyEmails
      if (!raw || !Array.isArray(raw)) continue
      for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue
        const email = typeof (entry as any).email === 'string' ? (entry as any).email.trim() : ''
        if (!email) continue
        const key = email.toLowerCase()
        if (seen.has(key)) continue // already captured a more-recent use
        const name = typeof (entry as any).name === 'string' ? (entry as any).name : undefined
        seen.set(key, { email, name, lastUsedAt: r.createdAt.toISOString() })
      }
    }

    return NextResponse.json({ recipients: Array.from(seen.values()) })
  } catch (error) {
    console.error('Recent recipients error:', error)
    return NextResponse.json({ error: 'Failed to load recent recipients' }, { status: 500 })
  }
}

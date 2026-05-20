import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth'
import {
  checkIntegrationAuth,
  clientIp,
  integrationJson,
  integrationOptions,
  rateLimit,
} from '@/lib/integrationAuth'

// POST /api/integrations/v1/verify-password
// Body: { email, password }
// Returns 200 + { ok: true, user } on success, 200 + { ok: false, reason }
// on credential failure / rate-limit / unknown user. Bearer auth via the
// shared INTEGRATION_API_KEY. Mel/WPPP MI calls this server-to-server.

const VERIFY_RATE_LIMIT_PER_MIN = 5

const accountTypeToRole = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  return raw.toLowerCase()
}

export function OPTIONS() {
  return integrationOptions()
}

export async function POST(request: NextRequest) {
  const auth = checkIntegrationAuth(request)
  if (!auth.ok) {
    return integrationJson({ error: auth.reason }, { status: 401 })
  }

  let body: { email?: unknown; password?: unknown }
  try {
    body = await request.json()
  } catch {
    return integrationJson({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    return integrationJson({ ok: false, reason: 'invalid_credentials' })
  }

  // Per-IP sliding window. 5/min/IP per the handoff spec.
  const ip = clientIp(request)
  const rl = rateLimit(`verify-password:${ip}`, VERIFY_RATE_LIMIT_PER_MIN)
  if (!rl.ok) {
    console.warn('[integrations] verify-password rate-limited', { ip })
    return integrationJson({ ok: false, reason: 'rate_limited' })
  }

  try {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      console.log('[integrations] verify-password user_not_found', { email })
      return integrationJson({ ok: false, reason: 'user_not_found' })
    }

    // No "active" column today — every user is treated as active. If/when
    // we add it, hook it in here and return "user_inactive" if false.

    const valid = await comparePassword(password, user.passwordHash)
    if (!valid) {
      console.log('[integrations] verify-password invalid_credentials', { email })
      return integrationJson({ ok: false, reason: 'invalid_credentials' })
    }

    console.log('[integrations] verify-password ok', { email, userId: user.id })

    return integrationJson({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: null,
        role: accountTypeToRole(user.accountType),
        active: true,
        imageUrl: user.profilePicture || null,
      },
    })
  } catch (error) {
    console.error('[integrations] verify-password error', error)
    return integrationJson({ error: 'Internal error' }, { status: 500 })
  }
}

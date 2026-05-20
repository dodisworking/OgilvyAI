import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import {
  checkIntegrationAuth,
  integrationJson,
  integrationOptions,
} from '@/lib/integrationAuth'

// GET /api/integrations/v1/users
//   ?active=true  (currently a no-op — all users are treated as active)
// Returns the full roster so Mel/WPPP MI can mirror it into its users table.
// Bearer auth via the shared INTEGRATION_API_KEY.

export function OPTIONS() {
  return integrationOptions()
}

export async function GET(request: NextRequest) {
  const auth = checkIntegrationAuth(request)
  if (!auth.ok) {
    return integrationJson({ error: auth.reason }, { status: 401 })
  }

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        accountType: true,
        profilePicture: true,
      },
      orderBy: { name: 'asc' },
    })

    const payload = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      title: null as string | null,
      role: u.accountType ? u.accountType.toLowerCase() : null,
      active: true,
      imageUrl: u.profilePicture || null,
    }))

    return integrationJson({
      generatedAt: new Date().toISOString(),
      count: payload.length,
      users: payload,
    })
  } catch (error) {
    console.error('[integrations] users list error', error)
    return integrationJson({ error: 'Failed to load users' }, { status: 500 })
  }
}

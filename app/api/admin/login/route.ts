import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, COOKIE_NAME } from '@/lib/session'
import { hashPassword } from '@/lib/auth'

const ADMIN_PORTAL_COOKIE = 'admin_portal_user'

// Admin portal passwords
const TIM_PASSWORD = 'Hellomynameistim'
const JESS_PASSWORD = 'Hellomynameisjess'

type AdminPortal = 'tim' | 'jess'

const PORTAL_PROFILE: Record<AdminPortal, { name: string; email: string; password: string }> = {
  tim: {
    name: 'Tim',
    email: 'tim.legallo@ogilvy.com',
    password: TIM_PASSWORD,
  },
  jess: {
    name: 'Jess',
    email: 'jessica.coccaro@ogilvy.com',
    password: JESS_PASSWORD,
  },
}

function isAdminPortal(value: unknown): value is AdminPortal {
  return value === 'tim' || value === 'jess'
}

export async function POST(request: NextRequest) {
  try {
    const body: { password?: string; portal?: unknown } = await request.json()
    const { password, portal } = body

    // Password is required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    let selectedPortal: AdminPortal | null = null

    if (isAdminPortal(portal)) {
      selectedPortal = portal
      if (password !== PORTAL_PROFILE[portal].password) {
        return NextResponse.json(
          { error: 'Invalid password' },
          { status: 401 }
        )
      }
    } else if (password === TIM_PASSWORD) {
      selectedPortal = 'tim'
    } else if (password === JESS_PASSWORD) {
      selectedPortal = 'jess'
    } else {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    if (!selectedPortal) {
      return NextResponse.json(
        { error: 'Invalid portal selection' },
        { status: 400 }
      )
    }

    // Prefer a real admin row if available, but do not block portal login if missing.
    // Some environments may not have seeded the admins table.
    const admin = await db.admin
      .findFirst({
        select: {
          id: true,
          email: true,
          name: true,
        },
      })
      .catch(() => null)

    const adminSessionIdentity = admin ?? {
      id: 'admin-portal',
      email: 'tim.legallo@ogilvy.com',
      name: 'Tim',
    }

    // Make sure a regular User row exists for the portal so the admin can also
    // submit their own time-off requests (Jess + Tim each get a real user
    // record with their work email — created the first time they log in).
    const profile = PORTAL_PROFILE[selectedPortal]
    try {
      const existingUser = await db.user.findUnique({ where: { email: profile.email } })
      if (!existingUser) {
        const placeholderHash = await hashPassword(`portal-${selectedPortal}-${Date.now()}`)
        await db.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            passwordHash: placeholderHash,
            accountType: 'PRODUCER',
          },
        })
      }
    } catch (err) {
      console.error('Failed to ensure portal user row exists:', err)
      // Non-fatal: login still works; submitting time off would just fail
      // later, which surfaces a clear error rather than blocking login.
    }

    // Create session in database
    const token = await createSession(adminSessionIdentity.id, adminSessionIdentity.email, true)

    // Create response with portal admin display data
    const response = NextResponse.json({
      admin: {
        id: adminSessionIdentity.id,
        email: profile.email,
        name: profile.name,
        portal: selectedPortal,
      },
    })

    // Set HTTP-only cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    response.cookies.set(ADMIN_PORTAL_COOKIE, selectedPortal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}

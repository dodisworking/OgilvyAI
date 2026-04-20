import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, COOKIE_NAME } from '@/lib/session'

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

export async function POST(request: NextRequest) {
  try {
    const { password, portal } = await request.json()

    // Password is required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    let selectedPortal: AdminPortal | null = null

    if (portal === 'tim' || portal === 'jess') {
      selectedPortal = portal
      if (password !== PORTAL_PROFILE[selectedPortal].password) {
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

    // Find the admin (Tim)
    const admin = await db.admin.findFirst()
    
    if (!admin) {
      return NextResponse.json(
        { error: 'No admin account found' },
        { status: 404 }
      )
    }

    // Create session in database
    const token = await createSession(admin.id, admin.email, true)

    const profile = PORTAL_PROFILE[selectedPortal]

    // Create response with portal admin display data
    const response = NextResponse.json({
      admin: {
        id: admin.id,
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

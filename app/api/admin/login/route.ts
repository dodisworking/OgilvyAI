import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, COOKIE_NAME } from '@/lib/session'

// Tim's password - required for admin login
const TIM_PASSWORD = 'Hellomynameistim'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    // Password is required
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Verify password
    if (password !== TIM_PASSWORD) {
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

    // Create response with admin data
    const response = NextResponse.json({
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
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

    return response
  } catch (error) {
    console.error('Admin login error:', error)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}

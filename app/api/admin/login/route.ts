import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth'
import { createSession, COOKIE_NAME } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password, autoLogin } = await request.json()

    let admin

    // If autoLogin is true, just find the first admin
    if (autoLogin) {
      admin = await db.admin.findFirst()
      
      if (!admin) {
        return NextResponse.json(
          { error: 'No admin account found' },
          { status: 404 }
        )
      }
    } else {
      // Normal login with credentials
      // Validation
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        )
      }

      // Find admin
      admin = await db.admin.findUnique({
        where: { email },
      })

      if (!admin) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Verify password
      const isValid = await comparePassword(password, admin.passwordHash)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        )
      }
    }

    // If password field doesn't exist, update it
    if (!admin.password) {
      await db.admin.update({
        where: { id: admin.id },
        data: { password: password },
      })
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
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createSession, COOKIE_NAME } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, profilePicture, accountType } = await request.json()

    const validAccountTypes = ['PRODUCER', 'CREATIVE', 'CLIENT', 'OTHER']
    const accountTypeValue = validAccountTypes.includes(accountType) ? accountType : 'OTHER'

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    if (!profilePicture) {
      return NextResponse.json(
        { error: 'Profile picture is required' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        password: password, // Store plain text for Isaac Mode
        name,
        profilePicture: profilePicture || null,
        accountType: accountTypeValue,
      },
    })

    // Create session in database
    const token = await createSession(user.id, user.email, false)

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
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
  } catch (error: any) {
    console.error('Registration error:', error)
    const errorMessage = error?.message || 'Failed to register user'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
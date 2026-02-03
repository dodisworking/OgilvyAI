import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'isaac_mode_unlock'
const MAX_AGE = 60 * 10 // 10 minutes

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    const expected = process.env.ISAAC_MODE_PASSWORD ?? 'Igomoonnasa'
    if (!password || password !== expected) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(COOKIE_NAME, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: MAX_AGE,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Isaac unlock error:', error)
    return NextResponse.json(
      { error: 'Failed to unlock' },
      { status: 500 }
    )
  }
}

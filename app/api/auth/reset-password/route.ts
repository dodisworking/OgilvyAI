import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { setUserPasswordWithHistory } from '@/lib/passwordHistory'
import { createSession, COOKIE_NAME } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: 'Email, code, and new password are required' },
        { status: 400 }
      )
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    if (!user) {
      return NextResponse.json({ error: 'Invalid code or email' }, { status: 400 })
    }

    const record = await db.passwordResetCode.findFirst({
      where: {
        userId: user.id,
        code: String(code).trim(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      )
    }

    await setUserPasswordWithHistory({
      userId: user.id,
      newPassword,
      reason: 'reset-password',
    })

    await db.passwordResetCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    // Burn any other unused codes for this user so they can't be replayed.
    await db.passwordResetCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    // Sign the user in immediately — they just proved control of the email.
    const token = await createSession(user.id, user.email, false)
    const response = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}

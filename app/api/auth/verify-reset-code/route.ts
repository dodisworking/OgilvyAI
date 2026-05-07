import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Checks a reset code without burning it. Lets the UI walk the user through
// "got the code? ok now pick a password" in two distinct steps so they
// don't have to re-type a new password if their code is wrong.
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
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
        { error: 'That code is invalid or has expired.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Verify reset code error:', error)
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 })
  }
}

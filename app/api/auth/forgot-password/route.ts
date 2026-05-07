import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetCodeEmail } from '@/lib/email'

const CODE_TTL_MINUTES = 15

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString()

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    // Always return success to avoid leaking which emails are registered.
    if (!user) {
      return NextResponse.json({ ok: true })
    }

    const code = generateCode()
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

    await db.passwordResetCode.create({
      data: { userId: user.id, code, expiresAt },
    })

    try {
      await sendPasswordResetCodeEmail({
        toName: user.name,
        toEmail: user.email,
        code,
        expiresInMinutes: CODE_TTL_MINUTES,
      })
    } catch (mailErr) {
      console.error('Failed to send password reset email:', mailErr)
      return NextResponse.json(
        { error: 'Could not send reset email. Try again in a minute.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

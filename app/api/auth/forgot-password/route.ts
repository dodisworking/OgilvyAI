import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetCodeEmail } from '@/lib/email'

const CODE_TTL_MINUTES = 15

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString()

const maskEmail = (email: string) => {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const head = local.slice(0, Math.min(2, local.length))
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: normalizedEmail } })

    // Internal app: tell the user clearly when the email isn't registered.
    // Anti-enumeration matters less than not leaving them stuck waiting.
    if (!user) {
      return NextResponse.json(
        { error: "We couldn't find an account with that email." },
        { status: 404 }
      )
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
      // Burn the code so a "send again" doesn't accumulate stale rows.
      await db.passwordResetCode.update({
        where: { id: (await db.passwordResetCode.findFirst({
          where: { userId: user.id, code, usedAt: null },
        }))?.id ?? '' },
        data: { usedAt: new Date() },
      }).catch(() => {})
      return NextResponse.json(
        { error: 'Could not send reset email. Try again in a minute, or check Gmail credentials are configured.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      expiresInMinutes: CODE_TTL_MINUTES,
      // Send back the partially-masked email so the UI can confirm the right one.
      maskedEmail: maskEmail(user.email),
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

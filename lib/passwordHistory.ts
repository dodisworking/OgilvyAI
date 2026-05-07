import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

interface RecordOptions {
  userId: string
  newPassword: string
  reason: 'register' | 'change-password' | 'reset-password' | 'admin-set'
}

// Hash the new password, write the user record AND a row to password_history
// (mirrors the existing legacy pattern of also storing the plaintext on User).
export async function setUserPasswordWithHistory({ userId, newPassword, reason }: RecordOptions) {
  const passwordHash = await hashPassword(newPassword)

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash, password: newPassword },
    }),
    db.passwordHistory.create({
      data: { userId, passwordHash, password: newPassword, reason },
    }),
  ])
}

export async function recordInitialPasswordHistory(args: {
  userId: string
  passwordHash: string
  plaintext?: string
  reason?: string
}) {
  await db.passwordHistory.create({
    data: {
      userId: args.userId,
      passwordHash: args.passwordHash,
      password: args.plaintext,
      reason: args.reason || 'register',
    },
  })
}

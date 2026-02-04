import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

// Only allow isaac.boruchowicz@ogilvy.com to access this endpoint
const ISAAC_EMAIL = 'isaac.boruchowicz@ogilvy.com'

async function ensureIsaac(request: NextRequest) {
  const cookieHeader = request.headers.get('cookie')
  const session = await getSessionFromCookie(cookieHeader)

  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const currentUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { email: true },
  })

  if (currentUser?.email !== ISAAC_EMAIL) {
    return { ok: false, response: NextResponse.json({ error: 'Access denied' }, { status: 403 }) }
  }

  return { ok: true, session }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await ensureIsaac(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { profilePicture } = body

    if (typeof profilePicture !== 'string' || profilePicture.length === 0) {
      return NextResponse.json({ error: 'Profile picture is required' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id: params.id },
      data: { profilePicture },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        profilePicture: true,
        accountType: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error: any) {
    console.error('Isaac mode update user error:', error)
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await ensureIsaac(request)
    if (!auth.ok) return auth.response

    await db.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'User deleted' })
  } catch (error: any) {
    console.error('Isaac mode delete user error:', error)
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    )
  }
}

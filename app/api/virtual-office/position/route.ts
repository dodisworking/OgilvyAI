import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session || session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { x, y, direction } = await request.json()

    // Update position and direction
    await db.virtualOfficeCheckin.update({
      where: { userId: session.userId },
      data: { 
        x, 
        y,
        // Note: direction field doesn't exist in schema yet, but we'll add it
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Update position error:', error)
    return NextResponse.json(
      { error: 'Failed to update position' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionFromCookie } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all checked-in users
    const checkedIn = await db.virtualOfficeCheckin.findMany({
      where: { isCheckedIn: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        checkInTime: 'desc',
      },
    })

    return NextResponse.json({ users: checkedIn })
  } catch (error: any) {
    console.error('Get checked-in users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checked-in users' },
      { status: 500 }
    )
  }
}

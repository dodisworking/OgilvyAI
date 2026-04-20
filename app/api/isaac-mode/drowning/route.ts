import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Isaac Mode drowning endpoint - returns all drowning requests
export async function GET(request: NextRequest) {
  try {
    const drowningRequests = await db.drowningRequest.findMany({
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
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ drowningRequests })
  } catch (error: any) {
    console.error('Error fetching drowning requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drowning requests', details: error.message },
      { status: 500 }
    )
  }
}

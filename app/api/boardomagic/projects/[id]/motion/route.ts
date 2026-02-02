import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const project = await db.boardomaticProject.findFirst({
      where: {
        id: params.id,
        userId: session.userId,
      },
      include: {
        shots: {
          include: {
            motionReview: true,
          },
          orderBy: { shotNumber: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Return motion descriptions from shots
    const motions = project.shots.map(shot => ({
      shotId: shot.id,
      shotNumber: shot.shotNumber,
      motionDescription: shot.motionDescription,
      motionReview: shot.motionReview,
    }))

    return NextResponse.json({ motions })
  } catch (error: any) {
    console.error('Error fetching motion descriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch motion descriptions', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const project = await db.boardomaticProject.findFirst({
      where: {
        id: params.id,
        userId: session.userId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { motions } = body // Array of { shotId, motionDescription }

    if (!Array.isArray(motions)) {
      return NextResponse.json(
        { error: 'Motions must be an array' },
        { status: 400 }
      )
    }

    // Update motion descriptions for shots
    const updatedShots = await Promise.all(
      motions.map(async (motionData: any) => {
        const { shotId, motionDescription } = motionData
        return db.shot.update({
          where: { id: shotId },
          data: { motionDescription },
        })
      })
    )

    return NextResponse.json({ shots: updatedShots })
  } catch (error: any) {
    console.error('Error updating motion descriptions:', error)
    return NextResponse.json(
      { error: 'Failed to update motion descriptions', details: error.message },
      { status: 500 }
    )
  }
}

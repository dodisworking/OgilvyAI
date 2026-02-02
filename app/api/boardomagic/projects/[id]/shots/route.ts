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
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const shots = await db.shot.findMany({
      where: { projectId: params.id },
      include: {
        characters: true,
        motionReview: true,
      },
      orderBy: { shotNumber: 'asc' },
    })

    return NextResponse.json({ shots })
  } catch (error: any) {
    console.error('Error fetching shots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shots', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { shotNumber, sceneDescription, motionDescription, duration } = body

    if (!shotNumber || !sceneDescription) {
      return NextResponse.json(
        { error: 'Shot number and scene description are required' },
        { status: 400 }
      )
    }

    const shot = await db.shot.create({
      data: {
        projectId: params.id,
        shotNumber,
        sceneDescription,
        motionDescription: motionDescription || null,
        duration: duration || 5, // Default 5 seconds
      },
      include: {
        characters: true,
        motionReview: true,
      },
    })

    return NextResponse.json({ shot }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating shot:', error)
    return NextResponse.json(
      { error: 'Failed to create shot', details: error.message },
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
    const { shots } = body // Array of shots to update

    if (!Array.isArray(shots)) {
      return NextResponse.json(
        { error: 'Shots must be an array' },
        { status: 400 }
      )
    }

    // Update all shots
    const updatedShots = await Promise.all(
      shots.map(async (shotData: any) => {
        const { id, shotNumber, sceneDescription, motionDescription, duration } = shotData
        return db.shot.update({
          where: { id },
          data: {
            shotNumber,
            sceneDescription,
            motionDescription,
            duration,
          },
          include: {
            characters: true,
            motionReview: true,
          },
        })
      })
    )

    return NextResponse.json({ shots: updatedShots })
  } catch (error: any) {
    console.error('Error updating shots:', error)
    return NextResponse.json(
      { error: 'Failed to update shots', details: error.message },
      { status: 500 }
    )
  }
}

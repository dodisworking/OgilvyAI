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

    const music = await db.music_descriptions.findUnique({
      where: { projectId: params.id },
    })

    return NextResponse.json({ music })
  } catch (error: any) {
    console.error('Error fetching music description:', error)
    return NextResponse.json(
      { error: 'Failed to fetch music description', details: error.message },
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
    const { description, tempoMarkers } = body

    if (!description) {
      return NextResponse.json(
        { error: 'Music description is required' },
        { status: 400 }
      )
    }

    // Get or create music description
    let music = await db.music_descriptions.findUnique({
      where: { projectId: params.id },
    })

    if (!music) {
      music = await db.music_descriptions.create({
        data: {
          id: `music_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: params.id,
          description,
          tempoMarkers: tempoMarkers ? JSON.parse(JSON.stringify(tempoMarkers)) : null,
          updatedAt: new Date(),
        },
      })
    } else {
      music = await db.music_descriptions.update({
        where: { id: music.id },
        data: {
          description,
          tempoMarkers: tempoMarkers ? JSON.parse(JSON.stringify(tempoMarkers)) : music.tempoMarkers,
        },
      })
    }

    return NextResponse.json({ music })
  } catch (error: any) {
    console.error('Error updating music description:', error)
    return NextResponse.json(
      { error: 'Failed to update music description', details: error.message },
      { status: 500 }
    )
  }
}

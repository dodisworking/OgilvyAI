import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

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
      include: {
        shots: true,
        music_descriptions: true,
        drawing_styles: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Update project status to GENERATING
    await db.boardomaticProject.update({
      where: { id: params.id },
      data: { status: 'GENERATING' },
    })

    // Create or update output record
    let output = await db.boardomatic_outputs.findUnique({
      where: { projectId: params.id },
    })

    if (!output) {
      output = await db.boardomatic_outputs.create({
        data: {
          id: `output_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId: params.id,
          status: 'PROCESSING',
          videoUrl: null,
          updatedAt: new Date(),
        },
      })
    } else {
      output = await db.boardomatic_outputs.update({
        where: { id: output.id },
        data: { status: 'PROCESSING' },
      })
    }

    // TODO: In the future, this will call AI video generation APIs
    // For now, return a placeholder response
    return NextResponse.json({
      message: 'Boardomatic generation started (placeholder)',
      output,
      note: 'AI video generation will be integrated here',
    })
  } catch (error: any) {
    console.error('Error starting generation:', error)
    return NextResponse.json(
      { error: 'Failed to start generation', details: error.message },
      { status: 500 }
    )
  }
}

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

    const output = await db.boardomatic_outputs.findUnique({
      where: { projectId: params.id },
    })

    return NextResponse.json({ output })
  } catch (error: any) {
    console.error('Error fetching generation status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch generation status', details: error.message },
      { status: 500 }
    )
  }
}

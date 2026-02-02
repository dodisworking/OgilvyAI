import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projects = await db.boardomaticProject.findMany({
      where: { userId: session.userId },
      include: {
        shots: {
          include: {
            characters: true,
          },
          orderBy: { shotNumber: 'asc' },
        },
        music: true,
        drawingStyle: {
          include: {
            references: true,
          },
        },
        output: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ projects })
  } catch (error: any) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      console.error('POST /api/boardomagic/projects: No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, script, totalDuration } = body

    console.log('POST /api/boardomagic/projects: Request body:', { title, script: script?.substring(0, 50), totalDuration })

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const project = await db.boardomaticProject.create({
      data: {
        userId: session.userId,
        title,
        script: script || '', // Allow empty script initially
        totalDuration: totalDuration || 60, // Default 60 seconds (1 minute)
        status: 'DRAFT',
      },
      include: {
        shots: true,
        music: true,
        drawingStyle: true,
        output: true,
      },
    })

    console.log('POST /api/boardomagic/projects: Project created successfully:', project.id)
    return NextResponse.json({ project }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating project:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: 'Failed to create project', details: error.message },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

const VALID_TYPES = ['SUGGESTION', 'BUG', 'IDEA'] as const

// POST - Submit a suggestion (optional auth; anonymous allowed)
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)

    let body: { type?: string; content?: string; submitterName?: string; submitterEmail?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const { type, content, submitterName, submitterEmail } = body

    if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: 'Type must be one of: SUGGESTION, BUG, IDEA' },
        { status: 400 }
      )
    }

    const trimmed = (content ?? '').trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    let userId: string | null = null
    let submitterNameVal: string | null = null
    let submitterEmailVal: string | null = null

    if (session) {
      userId = session.userId
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { name: true, email: true },
      })
      if (user) {
        submitterNameVal = user.name
        submitterEmailVal = user.email
      }
    } else {
      submitterNameVal = (submitterName ?? '').trim() || null
      submitterEmailVal = (submitterEmail ?? '').trim() || null
    }

    const suggestion = await db.suggestion.create({
      data: {
        type: type as (typeof VALID_TYPES)[number],
        content: trimmed,
        userId: userId ?? undefined,
        submitterName: submitterNameVal ?? undefined,
        submitterEmail: submitterEmailVal ?? undefined,
      },
    })

    return NextResponse.json({
      success: true,
      id: suggestion.id,
      message: 'Thanks! We got your submission.',
    })
  } catch (error: any) {
    console.error('Suggestions POST error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to submit suggestion' },
      { status: 500 }
    )
  }
}

// GET - List suggestions (requires auth; for viewing your/team submissions later)
export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const suggestions = await db.suggestion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        type: true,
        content: true,
        submitterName: true,
        submitterEmail: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    })

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('Suggestions GET error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Failed to load suggestions' },
      { status: 500 }
    )
  }
}

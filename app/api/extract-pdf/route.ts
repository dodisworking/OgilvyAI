import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

// POST - Extract text from uploaded PDF (for AI calendar import)
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('pdf') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No PDF file provided. Use form field "pdf".' },
        { status: 400 }
      )
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'File must be a PDF' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // pdf-parse v1.1.1: default export is a function(buffer) => Promise<{ text, numpages, ... }>
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(buffer)

    return NextResponse.json({
      text: data?.text ?? '',
      numpages: data?.numpages,
    })
  } catch (error: unknown) {
    console.error('PDF extract error:', error)
    return NextResponse.json(
      {
        error: 'Failed to extract text from PDF',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

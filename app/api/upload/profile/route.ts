import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image (JPEG, PNG, GIF, or WebP)' },
        { status: 400 }
      )
    }

    // The client compresses profile pictures before upload, so we keep only a
    // generous safety cap to reject obvious abuse (uncompressed RAW, etc.).
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File is unusually large even after compression. Try a different image.' },
        { status: 400 }
      )
    }

    // Convert file to base64 data URL
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Return the data URL - this gets stored directly in the database
    return NextResponse.json({ url: dataUrl })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

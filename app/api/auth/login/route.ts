import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth'
import { createSession, COOKIE_NAME } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValid = await comparePassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update plain text password if not stored
    if (!user.password) {
      await db.user.update({
        where: { id: user.id },
        data: { password: password },
      })
    }

    // Check if user needs a profile picture
    if (!user.profilePicture) {
      // Create session first so they can update their profile
      const token = await createSession(user.id, user.email, false)
      
      const response = NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        needsProfilePicture: true,
      })

      // Set HTTP-only cookie
      response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      })

      return response
    }

    // Create session in database
    let token: string
    try {
      token = await createSession(user.id, user.email, false)
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/login/route.ts:76',message:'Session created successfully',data:{userId:user.id,email:user.email,tokenLength:token.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    } catch (sessionError) {
      console.error('Session creation error:', sessionError)
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/login/route.ts:78',message:'Session creation failed',data:{error:String(sessionError),userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: 500 }
      )
    }

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      needsProfilePicture: false,
    })

    // Set HTTP-only cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/login/route.ts:102',message:'Cookie set in response',data:{cookieName:COOKIE_NAME,tokenLength:token.length,secure:process.env.NODE_ENV === 'production',sameSite:'lax',path:'/'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}
import { db } from './db'
import { generateToken, verifyToken } from './auth'

const SESSION_DURATION_DAYS = 7
export const COOKIE_NAME = 'auth_session'

export interface SessionData {
  userId: string
  email: string
  isAdmin?: boolean
}

export async function createSession(userId: string, email: string, isAdmin = false): Promise<string> {
  try {
    const token = generateToken({ userId, email, isAdmin })
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

    // Delete any existing sessions for this user first (optional - allows multiple sessions)
    // Or we could keep multiple sessions - for now, let's keep them
    
    await db.session.create({
      data: {
        userId,
        token,
        userType: isAdmin ? 'ADMIN' : 'USER',
        expiresAt,
      },
    })

    return token
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

export async function getSessionFromCookie(cookieHeader: string | null): Promise<SessionData | null> {
  if (!cookieHeader) {
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/session.ts:31',message:'No cookie header provided',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return null
  }

  // Extract cookie value
  const cookieObj = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = decodeURIComponent(value)
    return acc
  }, {} as Record<string, string>)

  const token = cookieObj[COOKIE_NAME]
  // #region agent log
  fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/session.ts:40',message:'Token extracted from cookie',data:{tokenFound:!!token,tokenLength:token?.length,cookieName:COOKIE_NAME},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (!token) return null

  // Verify token first
  const payload = verifyToken(token)
  // #region agent log
  fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/session.ts:45',message:'Token verification result',data:{payloadValid:!!payload,userId:payload?.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (!payload) return null

  // Get session from database
  const session = await db.session.findUnique({
    where: { token },
  })
  // #region agent log
  fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/session.ts:50',message:'Database session lookup',data:{sessionFound:!!session,expiresAt:session?.expiresAt?.toISOString(),isExpired:session ? session.expiresAt < new Date() : null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (!session || session.expiresAt < new Date()) {
    // Session expired, delete it
    await db.session.deleteMany({ where: { token } }).catch(() => {})
    return null
  }

  return {
    userId: payload.userId,
    email: payload.email,
    isAdmin: payload.isAdmin || false,
  }
}

export async function deleteSession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token } })
}

// Helper to get cookie from NextRequest
export function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = decodeURIComponent(value)
    return acc
  }, {} as Record<string, string>)
  
  return cookies[name] || null
}

// Clean up expired sessions (can be run periodically)
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
  return result.count
}
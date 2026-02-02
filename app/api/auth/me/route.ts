import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:7',message:'Auth check - cookie header received',data:{cookieHeader:cookieHeader ? cookieHeader.substring(0,100) + '...' : null,hasCookie:!!cookieHeader},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const session = await getSessionFromCookie(cookieHeader)
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:9',message:'Session lookup result',data:{sessionFound:!!session,userId:session?.userId,isAdmin:session?.isAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (!session) {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:12',message:'No session found - returning 401',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user or admin data based on session type
    if (session.isAdmin) {
      const admin = await db.admin.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true },
      })

      if (!admin) {
        return NextResponse.json(
          { error: 'Admin not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ user: admin, isAdmin: true })
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:18',message:'Fetching user from database',data:{userId:session.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Fetch user - temporarily without avatarData until Prisma client is updated
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { id: true, email: true, name: true, profilePicture: true },
      })
      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:47',message:'User fetched from database',data:{userFound:!!user,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Add null avatarData for compatibility (will be populated once Prisma client is updated)
      if (user) {
        (user as any).avatarData = null
      }

      if (!user) {
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:33',message:'User not found in database',data:{userId:session.userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:42',message:'Returning user data',data:{userId:user.id,hasAvatarData:!!(user as { avatarData?: unknown }).avatarData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      return NextResponse.json({ user, isAdmin: false })
    }
  } catch (error) {
    console.error('Get user error:', error)
    // #region agent log
    fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/auth/me/route.ts:47',message:'Catch block - error occurred',data:{error:String(error),errorName:(error as Error)?.name,errorMessage:(error as Error)?.message,errorStack:(error as Error)?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}
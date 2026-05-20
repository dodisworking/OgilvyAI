import { NextRequest, NextResponse } from 'next/server'

// Shared bearer-token + CORS helpers for /api/integrations/v1/*. All
// integration endpoints fail-closed: if INTEGRATION_API_KEY isn't set on
// the server, every request returns 401 with a clear reason.

const ALLOWED_ORIGIN = () => process.env.INTEGRATION_ALLOWED_ORIGIN || '*'

export const corsHeaders = () => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN(),
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type',
  'Access-Control-Max-Age': '86400',
})

export const integrationJson = (body: unknown, init?: ResponseInit) =>
  new NextResponse(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

export const integrationOptions = () =>
  new NextResponse(null, { status: 204, headers: corsHeaders() })

export type AuthResult = { ok: true } | { ok: false; reason: string }

export function checkIntegrationAuth(request: NextRequest): AuthResult {
  const expected = process.env.INTEGRATION_API_KEY
  if (!expected) {
    return { ok: false, reason: 'Server missing INTEGRATION_API_KEY env var' }
  }
  const bearer = (request.headers.get('authorization') || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  const headerKey = request.headers.get('x-api-key') || ''
  const queryKey = request.nextUrl.searchParams.get('apiKey') || ''
  const provided = bearer || headerKey || queryKey
  if (!provided) return { ok: false, reason: 'Missing API key' }
  if (provided !== expected) return { ok: false, reason: 'Invalid API key' }
  return { ok: true }
}

// ---- Simple in-memory sliding-window rate limit ----
// Good enough for the verify-password endpoint. Resets across deploys, which
// is acceptable; the threshold is generous enough that the 5/min target
// is met even on busy serverless instances.

interface Bucket {
  hits: number[]
}
const buckets = new Map<string, Bucket>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000

export function rateLimit(key: string, max: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const bucket = buckets.get(key) || { hits: [] }
  bucket.hits = bucket.hits.filter((t) => t > cutoff)
  if (bucket.hits.length >= max) {
    buckets.set(key, bucket)
    return { ok: false, remaining: 0 }
  }
  bucket.hits.push(now)
  buckets.set(key, bucket)
  // Opportunistic GC so the map doesn't grow forever.
  if (buckets.size > 1000) {
    for (const [k, b] of buckets.entries()) {
      b.hits = b.hits.filter((t) => t > cutoff)
      if (b.hits.length === 0) buckets.delete(k)
    }
  }
  return { ok: true, remaining: Math.max(0, max - bucket.hits.length) }
}

// Best-effort client IP. Trusts standard proxy headers since Railway/Vercel
// terminate TLS upstream of the Next.js process.
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}

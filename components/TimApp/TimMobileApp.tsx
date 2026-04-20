'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Request } from '@/types'

const AdminDashboard = dynamic(() => import('@/components/Admin/AdminDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
    </div>
  ),
})

const MasterCalendar = dynamic(() => import('@/components/Admin/MasterCalendar'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
    </div>
  ),
})

type Tab = 'requests' | 'calendar'
type HomeView = 'home' | Tab

function parseRequests(raw: unknown[]): Request[] {
  return raw.map((r: any) => ({
    ...r,
    startDate: new Date(r.startDate),
    endDate: new Date(r.endDate),
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  }))
}

export default function TimMobileApp() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'wrong_portal' | 'ready'>('loading')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [tab, setTab] = useState<Tab>('requests')
  const [view, setView] = useState<HomeView>('home')
  const [allRequests, setAllRequests] = useState<Request[]>([])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/requests', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setAllRequests(parseRequests(data.requests || []))
    } catch {
      /* ignore */
    }
  }, [])

  const checkSession = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) {
        setPhase('login')
        return
      }
      const data = await res.json()
      if (!data.isAdmin) {
        setPhase('login')
        return
      }
      if (data.adminPortal === 'jess') {
        setPhase('wrong_portal')
        return
      }
      await fetchRequests()
      setPhase('ready')
    } catch {
      setPhase('login')
    }
  }, [fetchRequests])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, portal: 'tim' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoginError(data.error || 'Could not sign in')
        return
      }
      setPassword('')
      await checkSession()
    } catch {
      setLoginError('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setAllRequests([])
    setPhase('login')
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    )
  }

  if (phase === 'wrong_portal') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 px-5 py-4">
          <p className="text-lg font-semibold text-amber-100">Jess session detected</p>
          <p className="mt-2 text-sm text-amber-200/90">
            The Tim App is only for Tim. Sign out and sign in with Tim&apos;s password, or use the main admin site.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          Sign out
        </button>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div className="flex min-h-dvh flex-col justify-center px-6 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">Production</p>
            <h1 className="mt-2 text-3xl font-bold text-white">The Tim App</h1>
            <p className="mt-2 text-sm text-slate-400">Sign in with Tim&apos;s admin password</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="Tim portal password"
              />
            </label>
            {loginError ? <p className="text-sm text-red-400">{loginError}</p> : null}
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50 active:scale-[0.99]"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-500">
            Same account as the main site — works on your Vercel URL once deployed.
          </p>
        </div>
      </div>
    )
  }

  const pending = allRequests.filter((r) => r.status === 'PENDING').length
  const approved = allRequests.filter((r) => r.status === 'APPROVED').length
  const rejected = allRequests.filter((r) => r.status === 'REJECTED').length
  const total = allRequests.length
  const onHome = view === 'home'

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">The Tim App</h1>
            <p className="text-xs text-slate-400">
              {onHome ? `Hi Tim — ${pending} pending to review` : tab === 'requests' ? 'Requests review' : 'Time off viewer'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 active:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3">
        {onHome && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pb-2">
            <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-700/20 via-slate-900 to-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-indigo-300">Your tools</p>
              <h2 className="mt-1 text-xl font-bold text-white">What do you want to do?</h2>
              <p className="mt-1 text-sm text-slate-300">Open one app at a time for a cleaner mobile experience.</p>
            </section>

            <button
              type="button"
              onClick={() => {
                setTab('calendar')
                setView('calendar')
              }}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left transition-colors active:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-indigo-300">Time Off Viewer</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Master calendar</h3>
                  <p className="mt-1 text-sm text-slate-400">View team coverage and schedule conflicts by month.</p>
                </div>
                <span className="text-2xl">📅</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('requests')
                setView('requests')
              }}
              className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left transition-colors active:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-fuchsia-300">Request Review</p>
                  <h3 className="mt-1 text-lg font-bold text-white">Review everything</h3>
                  <p className="mt-1 text-sm text-slate-400">Approve/reject requests with full context and notes.</p>
                </div>
                <span className="text-2xl">📋</span>
              </div>
            </button>

            <section className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="rounded-xl bg-slate-800/80 p-3">
                <p className="text-2xl font-bold text-white">{total}</p>
                <p className="text-xs text-slate-400">Total</p>
              </div>
              <div className="rounded-xl bg-amber-900/20 p-3">
                <p className="text-2xl font-bold text-amber-300">{pending}</p>
                <p className="text-xs text-amber-200/80">Pending</p>
              </div>
              <div className="rounded-xl bg-emerald-900/20 p-3">
                <p className="text-2xl font-bold text-emerald-300">{approved}</p>
                <p className="text-xs text-emerald-200/80">Approved</p>
              </div>
              <div className="rounded-xl bg-rose-900/20 p-3">
                <p className="text-2xl font-bold text-rose-300">{rejected}</p>
                <p className="text-xs text-rose-200/80">Rejected</p>
              </div>
            </section>
          </div>
        )}

        {!onHome && tab === 'requests' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <AdminDashboard requests={allRequests} onRefresh={fetchRequests} variant="mobile" />
          </div>
        )}
        {!onHome && tab === 'calendar' && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/50">
            <div className="border-b border-slate-700 px-3 py-2">
              <h2 className="text-sm font-semibold text-white">Master calendar</h2>
              <p className="text-xs text-slate-400">Swipe horizontally on the grid. Edit & approve like desktop.</p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <MasterCalendar
                requestsData={allRequests}
                showEditButton
                allowPendingApproval
                updateEndpoint="/api/admin/requests"
                onRequestUpdated={fetchRequests}
              />
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg gap-2">
          <button
            type="button"
            onClick={() => setView('home')}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium transition-colors ${
              onHome ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-lg leading-none">🏠</span>
            Apps
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('requests')
              setView('requests')
            }}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium transition-colors ${
              !onHome && tab === 'requests' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-lg leading-none">📋</span>
            Requests
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('calendar')
              setView('calendar')
            }}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-medium transition-colors ${
              !onHome && tab === 'calendar' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="text-lg leading-none">📅</span>
            Master calendar
          </button>
        </div>
      </nav>
    </div>
  )
}

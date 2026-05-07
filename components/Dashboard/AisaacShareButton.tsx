'use client'

import { useEffect, useMemo, useState } from 'react'
import { Request } from '@/types'

interface NotifyUser {
  id: string
  name: string
  email: string
  profilePicture?: string | null
}

interface AisaacShareButtonProps {
  request: Request
  onShared?: (count: number) => void
}

interface NotifyEntry {
  email: string
  name?: string
}

export default function AisaacShareButton({ request, onShared }: AisaacShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<NotifyUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<NotifyEntry[]>([])
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Existing recipients — already invited, shown as locked chips so the user
  // doesn't accidentally try to re-send to them.
  const alreadyInvited: NotifyEntry[] = useMemo(
    () => (Array.isArray(request.notifyEmails) ? (request.notifyEmails as NotifyEntry[]) : []),
    [request.notifyEmails]
  )
  const alreadyInvitedSet = useMemo(
    () => new Set(alreadyInvited.map((e) => e.email.toLowerCase())),
    [alreadyInvited]
  )

  useEffect(() => {
    if (!open || allUsers.length > 0) return
    let cancelled = false
    setIsLoadingUsers(true)
    fetch('/api/drowning/users', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return
        const users: NotifyUser[] = data.users || []
        const requesterEmail = request.user?.email?.toLowerCase()
        setAllUsers(
          requesterEmail ? users.filter((u) => u.email.toLowerCase() !== requesterEmail) : users
        )
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, allUsers.length, request.user?.email])

  const isPicked = (email: string) => picked.some((p) => p.email.toLowerCase() === email.toLowerCase())

  const togglePickUser = (u: NotifyUser) => {
    if (alreadyInvitedSet.has(u.email.toLowerCase())) return
    if (isPicked(u.email)) {
      setPicked((prev) => prev.filter((p) => p.email.toLowerCase() !== u.email.toLowerCase()))
    } else {
      setPicked((prev) => [...prev, { name: u.name, email: u.email }])
    }
  }

  const removePicked = (email: string) =>
    setPicked((prev) => prev.filter((p) => p.email.toLowerCase() !== email.toLowerCase()))

  const addCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setCustomError('Enter a valid email')
      return
    }
    if (alreadyInvitedSet.has(trimmed.toLowerCase())) {
      setCustomError('They already have the invite')
      return
    }
    if (isPicked(trimmed)) {
      setCustomError('Already added')
      return
    }
    setPicked((prev) => [...prev, { email: trimmed }])
    setCustomInput('')
    setCustomError('')
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [allUsers, search])

  const close = () => {
    setOpen(false)
    setSearch('')
    setPicked([])
    setCustomInput('')
    setCustomError('')
    setError('')
    setSuccessMessage('')
  }

  const handleShare = async () => {
    setError('')
    setSuccessMessage('')
    if (picked.length === 0) {
      setError('Pick at least one person to share with.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/requests/${request.id}/share-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notifyEmails: picked }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not share invite')
      }
      const count = typeof data.sent === 'number' ? data.sent : picked.length
      setSuccessMessage(
        count > 0
          ? `🥷 Sent the invite to ${count} ${count === 1 ? 'person' : 'people'}.`
          : (data.message || 'Already shared with those people.')
      )
      onShared?.(count)
      setPicked([])
      setTimeout(close, 1400)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-px"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)',
        }}
      >
        <span className="text-base leading-none">🥷</span>
        <span>Aisaac Assistant</span>
        <span className="hidden sm:inline text-[11px] font-medium opacity-90 px-1.5 py-0.5 rounded bg-white/20">
          Share invite
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={close}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl"
              aria-label="Close"
            >
              ×
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 text-white shadow"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)',
                }}
              >
                🥷
              </div>
              <div>
                <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Aisaac Assistant
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Share this approved time-off invite with more people. They&apos;ll get an
                  Outlook calendar invite for the same days.
                </p>
              </div>
            </div>

            {alreadyInvited.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Already invited:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {alreadyInvited.map((entry) => (
                    <span
                      key={entry.email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs"
                    >
                      ✓ {entry.name || entry.email}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {picked.length > 0 && (
              <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex flex-wrap gap-1.5">
                  {picked.map((entry) => (
                    <span
                      key={entry.email}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-purple-600 text-white text-xs font-medium"
                    >
                      {entry.name || entry.email}
                      <button
                        type="button"
                        onClick={() => removePicked(entry.email)}
                        className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                        aria-label={`Remove ${entry.email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teammates…"
              className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
            />
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
              {isLoadingUsers ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                  {search ? 'No matches' : 'No teammates found'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredUsers.map((u) => {
                    const isInvited = alreadyInvitedSet.has(u.email.toLowerCase())
                    const checked = isPicked(u.email)
                    return (
                      <li key={u.id}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                            isInvited
                              ? 'opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900/30'
                              : checked
                                ? 'bg-purple-50 dark:bg-purple-900/30 cursor-pointer'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isInvited}
                            checked={checked || isInvited}
                            onChange={() => togglePickUser(u)}
                            className="h-4 w-4 text-purple-600 focus:ring-purple-500 rounded"
                          />
                          {u.profilePicture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={u.profilePicture}
                              alt={u.name}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-indigo-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                              {u.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                              {u.name}
                              {isInvited && (
                                <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-500">
                                  invited
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                          </div>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Or add an email manually:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={customInput}
                  onChange={(e) => {
                    setCustomInput(e.target.value)
                    if (customError) setCustomError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustom()
                    }
                  }}
                  placeholder="someone@company.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  className="px-3 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
              {customError && (
                <p className="text-xs text-red-600 mt-1">{customError}</p>
              )}
            </div>

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mt-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={close}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShare}
                disabled={submitting || picked.length === 0}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background:
                    'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)',
                }}
              >
                {submitting
                  ? 'Sending…'
                  : picked.length > 0
                    ? `🥷 Send invite to ${picked.length}`
                    : '🥷 Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

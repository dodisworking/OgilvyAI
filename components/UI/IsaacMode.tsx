'use client'

import { useState, useEffect } from 'react'
import Button from './Button'

interface User {
  id: string
  email: string
  name: string
  password?: string | null
  passwordHash: string
  createdAt: string
}

interface IsaacModeData {
  users: User[]
  admins: User[]
}

export default function IsaacMode() {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<IsaacModeData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [checkingUnlock, setCheckingUnlock] = useState(false)
  const [accessPassword, setAccessPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        setError(errorData.error || `Error: ${response.status} ${response.statusText}`)
        setData(null)
        return
      }

      const result = await response.json()
      setData(result)
    } catch (error: any) {
      console.error('Failed to fetch users:', error)
      setError(error.message || 'Failed to fetch users. Are you logged in as admin?')
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const checkUnlockStatus = async () => {
    setCheckingUnlock(true)
    try {
      const res = await fetch('/api/admin/isaac-unlock-status', { credentials: 'include' })
      const json = await res.json()
      setUnlocked(json.unlocked === true)
      if (json.unlocked) {
        fetchData()
      }
    } catch {
      setUnlocked(false)
    } finally {
      setCheckingUnlock(false)
    }
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setUnlocking(true)
    try {
      const res = await fetch('/api/admin/isaac-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: accessPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setPasswordError(json.error || 'Invalid password')
        return
      }
      setUnlocked(true)
      setAccessPassword('')
      fetchData()
    } catch {
      setPasswordError('Failed to unlock')
    } finally {
      setUnlocking(false)
    }
  }

  const handleOpen = () => {
    setIsOpen(true)
    setError(null)
    setPasswordError(null)
    if (!unlocked) {
      checkUnlockStatus()
    } else if (!data) {
      fetchData()
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setAccessPassword('')
    setPasswordError(null)
  }

  return (
    <>
      {/* Star Button */}
      <button
        onClick={handleOpen}
        className="fixed top-4 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center text-white text-xl"
        title="Isaac Mode"
      >
        ⭐
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                    ⭐ Isaac Mode - All Logins
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {unlocked ? 'All registered users and admins' : 'Enter password to view logins'}
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {!unlocked ? (
                <>
                  {checkingUnlock ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                      <p>Checking access...</p>
                    </div>
                  ) : (
                    <form onSubmit={handleUnlock} className="max-w-sm mx-auto py-8 space-y-4">
                      <label htmlFor="isaac-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Password
                      </label>
                      <input
                        id="isaac-password"
                        type="password"
                        value={accessPassword}
                        onChange={(e) => { setAccessPassword(e.target.value); setPasswordError(null) }}
                        placeholder="Enter password"
                        className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-yellow-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        autoFocus
                      />
                      {passwordError && (
                        <p className="text-red-600 dark:text-red-400 text-sm">{passwordError}</p>
                      )}
                      <Button type="submit" isLoading={unlocking} disabled={!accessPassword.trim()}>
                        Unlock
                      </Button>
                    </form>
                  )}
                </>
              ) : (
                <>
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <p className="text-red-700 dark:text-red-400 font-semibold">Error</p>
                  <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
                  <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                    Make sure you&apos;re logged in as an admin to view this.
                  </p>
                </div>
              )}
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                  <p>Loading...</p>
                </div>
              ) : data ? (
                <div className="space-y-8">
                  {/* Admins Section */}
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-purple-600 dark:text-purple-400">
                      Admins ({data.admins.length})
                    </h3>
                    <div className="space-y-3">
                      {data.admins.map((admin) => (
                        <div
                          key={admin.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                        >
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name</p>
                                <p className="font-semibold">{admin.name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                                <p className="font-semibold">{admin.email}</p>
                              </div>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                                {admin.password || 'Not stored yet'}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Created: {new Date(admin.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {data.admins.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No admins found</p>
                      )}
                    </div>
                  </div>

                  {/* Users Section */}
                  <div>
                    <h3 className="text-xl font-bold mb-4 text-blue-600 dark:text-blue-400">
                      Employees ({data.users.length})
                    </h3>
                    <div className="space-y-3">
                      {data.users.map((user) => (
                        <div
                          key={user.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
                        >
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Name</p>
                                <p className="font-semibold">{user.name}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                                <p className="font-semibold">{user.email}</p>
                              </div>
                            </div>
                            <div className="md:col-span-3">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Password</p>
                              <p className="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-800">
                                {user.password || 'Not stored yet'}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Created: {new Date(user.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                      {data.users.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No users found</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No data available
                </div>
              )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              {unlocked && (
                <Button onClick={fetchData} className="ml-3" isLoading={isLoading}>
                  Refresh
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

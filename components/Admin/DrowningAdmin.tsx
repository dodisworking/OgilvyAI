'use client'

import { useState, useEffect } from 'react'
import Button from '../UI/Button'

interface User {
  id: string
  name: string
  email: string
  profilePicture?: string | null
  createdAt: string
}

interface DrowningRequest {
  id: string
  userId: string
  user: {
    name: string
    email: string
    profilePicture?: string | null
  }
  startDate: string
  endDate: string
  natureOfNeed: string | null
  createdAt: string
  notifiedUsers: string[] | null
}

export default function DrowningAdmin() {
  const [drowningRequests, setDrowningRequests] = useState<DrowningRequest[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedRequest, setSelectedRequest] = useState<DrowningRequest | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [showUserSelector, setShowUserSelector] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    fetchDrowningRequests()
    fetchUsers()
  }, [])

  const fetchDrowningRequests = async () => {
    try {
      const response = await fetch('/api/drowning', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setDrowningRequests(data.drowningRequests || [])
      }
    } catch (error) {
      console.error('Failed to fetch drowning requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/drowning/users', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleSelectAll = () => {
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set())
    } else {
      setSelectedUserIds(new Set(users.map(u => u.id)))
    }
  }

  const handleToggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUserIds(newSelected)
  }

  const handleOpenUserSelector = (request: DrowningRequest) => {
    setSelectedRequest(request)
    // Pre-select all users
    setSelectedUserIds(new Set(users.map(u => u.id)))
    setShowUserSelector(true)
  }

  const handleSendNotifications = async () => {
    if (!selectedRequest || selectedUserIds.size === 0) {
      alert('Please select at least one user to notify')
      return
    }

    setIsSending(true)
    try {
      const response = await fetch('/api/drowning/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          drowningRequestId: selectedRequest.id,
          userIds: Array.from(selectedUserIds),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(`✅ Notifications sent to ${data.notifiedUsers?.length || 0} user(s)!`)
        setShowUserSelector(false)
        setSelectedRequest(null)
        setSelectedUserIds(new Set())
        fetchDrowningRequests()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to send notifications')
      }
    } catch (error) {
      console.error('Failed to send notifications:', error)
      alert('Failed to send notifications. Please try again.')
    } finally {
      setIsSending(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading drowning requests...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <span>🆘</span> Drowning Requests <span>🌊</span>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
          <span>📊</span> {drowningRequests.length} request{drowningRequests.length !== 1 ? 's' : ''}
        </p>
      </div>

      {drowningRequests.length === 0 ? (
        <div className="text-center py-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-4xl mb-4">🎉🌊</p>
          <p className="text-gray-600 dark:text-gray-400">No drowning requests yet. Everyone is doing great! 🏖️</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drowningRequests.map((request) => (
            <div
              key={request.id}
              className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {request.user.profilePicture ? (
                    <div className="relative">
                      <img
                        src={request.user.profilePicture}
                        alt={request.user.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-blue-300"
                      />
                      <span className="absolute -top-1 -right-1 text-xl">🌊</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-lg">
                        {request.user.name[0].toUpperCase()}
                      </div>
                      <span className="absolute -top-1 -right-1 text-xl">🌊</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 mb-1 flex items-center gap-2">
                      <span>🆘</span> {request.user.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{request.user.email}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                  <p>{formatDate(request.createdAt)}</p>
                  {request.notifiedUsers && request.notifiedUsers.length > 0 && (
                    <p className="text-green-600 dark:text-green-400 mt-1">
                      ✓ Notified {request.notifiedUsers.length} user{request.notifiedUsers.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <p className="text-sm flex items-center gap-2">
                  <span className="font-semibold flex items-center gap-1">
                    <span>📅</span> Dates:
                  </span>
                  {formatDate(request.startDate)} - {formatDate(request.endDate)}
                </p>
                {request.natureOfNeed && (
                  <p className="text-sm flex items-center gap-2">
                    <span className="font-semibold flex items-center gap-1">
                      <span>💬</span> Nature of Need:
                    </span>
                    {request.natureOfNeed}
                  </p>
                )}
              </div>

              <Button
                onClick={() => handleOpenUserSelector(request)}
                variant="primary"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {request.notifiedUsers && request.notifiedUsers.length > 0
                  ? '📧 Re-send Notifications'
                  : '📧 Send to All Users'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* User Selector Modal */}
      {showUserSelector && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => {
                setShowUserSelector(false)
                setSelectedRequest(null)
                setSelectedUserIds(new Set())
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>

            <h2 className="text-2xl font-bold mb-2 text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <span>🆘</span> Select Users to Notify <span>📧</span>
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 flex items-center gap-1">
              <span>💬</span> Choose which users should receive a notification about{' '}
              <strong>{selectedRequest.user.name}&apos;s</strong> request for help. <span>🌊</span>
            </p>

            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {selectedUserIds.size === users.length ? 'Deselect All' : 'Select All'}
              </button>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedUserIds.size} of {users.length} selected
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
              <div className="space-y-2">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(user.id)}
                      onChange={() => handleToggleUser(user.id)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    {user.profilePicture ? (
                      <div className="relative mr-3">
                        <img
                          src={user.profilePicture}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-blue-300"
                        />
                        <span className="absolute -top-0.5 -right-0.5 text-sm">👤</span>
                      </div>
                    ) : (
                      <div className="relative mr-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-sm">
                          {user.name[0].toUpperCase()}
                        </div>
                        <span className="absolute -top-0.5 -right-0.5 text-sm">👤</span>
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUserSelector(false)
                  setSelectedRequest(null)
                  setSelectedUserIds(new Set())
                }}
                className="flex-1"
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendNotifications}
                variant="primary"
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                disabled={isSending || selectedUserIds.size === 0}
                isLoading={isSending}
              >
                📧 Send to {selectedUserIds.size} User{selectedUserIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

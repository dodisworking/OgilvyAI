'use client'

import { useEffect, useState } from 'react'

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
}

interface DrowningRequestListProps {
  onClose: () => void
}

export default function DrowningRequestList({ onClose }: DrowningRequestListProps) {
  const [drowningRequests, setDrowningRequests] = useState<DrowningRequest[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedRequest, setSelectedRequest] = useState<DrowningRequest | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchDrowningRequests()
    }
  }, [currentUser])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error)
    }
  }

  const fetchDrowningRequests = async () => {
    try {
      const response = await fetch('/api/drowning', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        // Filter out the current user's own requests - only show others who need help
        const othersRequests = (data.drowningRequests || []).filter(
          (req: DrowningRequest) => {
            return currentUser ? req.userId !== currentUser.id : true
          }
        )
        setDrowningRequests(othersRequests)
      }
    } catch (error) {
      console.error('Failed to fetch drowning requests:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAcceptMission = async (request: DrowningRequest) => {
    if (!currentUser) {
      alert('Please log in to accept missions')
      return
    }

    setIsAccepting(true)
    try {
      const response = await fetch('/api/drowning/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          drowningRequestId: request.id,
        }),
      })

      if (response.ok) {
        alert(`✅ Mission accepted! ${request.user.name} has been notified that you're coming to the rescue! 🚑`)
        setSelectedRequest(null)
        fetchDrowningRequests()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to accept mission')
      }
    } catch (error) {
      console.error('Failed to accept mission:', error)
      alert('Failed to accept mission. Please try again.')
    } finally {
      setIsAccepting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start.toDateString() === end.toDateString()) {
      return formatDate(startDate)
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <span>🚑</span> Who Needs Your Rescue <span>🌊</span>
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading rescue requests...</p>
        </div>
      ) : drowningRequests.length === 0 ? (
        <div className="text-center py-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-4xl mb-4">🎉🌊</p>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Everyone is doing great! No one needs rescue right now. 🏖️
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {drowningRequests.map((request) => (
            <div
              key={request.id}
              className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700 p-6 hover:shadow-lg transition-shadow"
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
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                      <span>🆘</span> {request.user.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {request.user.email}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  <p>{formatDate(request.createdAt)}</p>
                </div>
              </div>

              <div className="mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <span>📅</span> Dates:
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatDateRange(request.startDate, request.endDate)}
                  </span>
                </div>
                {request.natureOfNeed && (
                  <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-blue-200 dark:border-blue-700">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                      <span>💬</span> Nature of Need:
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {request.natureOfNeed}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRequest(request)}
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all font-medium text-sm"
                >
                  📋 View Request
                </button>
                <button
                  onClick={() => handleAcceptMission(request)}
                  disabled={isAccepting}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚑 Accept Mission
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => setSelectedRequest(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
                <span>🆘</span> Rescue Mission Details <span>🚑</span>
              </h2>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex items-center gap-3 mb-4">
                {selectedRequest.user.profilePicture ? (
                  <div className="relative">
                    <img
                      src={selectedRequest.user.profilePicture}
                      alt={selectedRequest.user.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-300"
                    />
                    <span className="absolute -top-1 -right-1 text-2xl">🌊</span>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 flex items-center justify-center text-white font-semibold text-2xl">
                      {selectedRequest.user.name[0].toUpperCase()}
                    </div>
                    <span className="absolute -top-1 -right-1 text-2xl">🌊</span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <span>🆘</span> {selectedRequest.user.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedRequest.user.email}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <span>📅</span> Dates Needed:
                </p>
                <p className="text-base text-gray-700 dark:text-gray-300">
                  {formatDateRange(selectedRequest.startDate, selectedRequest.endDate)}
                </p>
              </div>

              {selectedRequest.natureOfNeed && (
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <span>💬</span> Nature of Need:
                  </p>
                  <p className="text-base text-gray-700 dark:text-gray-300">
                    {selectedRequest.natureOfNeed}
                  </p>
                </div>
              )}

              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Request submitted: {formatDate(selectedRequest.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setSelectedRequest(null)}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Close
              </button>
              <button
                onClick={() => handleAcceptMission(selectedRequest)}
                disabled={isAccepting}
                className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? 'Accepting...' : '🚑 Accept Mission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

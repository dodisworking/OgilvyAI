'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Button from '../UI/Button'
import { Request } from '@/types'

// Lazy load admin components
const AdminDashboard = dynamic(() => import('@/components/Admin/AdminDashboard'), { ssr: false })
const MasterCalendar = dynamic(() => import('@/components/Admin/MasterCalendar'), { ssr: false })
const DrowningAdmin = dynamic(() => import('@/components/Admin/DrowningAdmin'), { ssr: false })

interface User {
  id: string
  email: string
  name: string
  password: string
  profilePicture?: string | null
  accountType?: string | null
  createdAt: string
}

interface IsaacModeProps {
  onClose: () => void
}

type ViewMode = 'users' | 'tim-calendar' | 'tim-requests' | 'tim-drowning' | 'edit-requests'

// Helper to safely get date string from Date or string
const getDateString = (date: unknown): string => {
  if (typeof date === 'string') {
    return date.split('T')[0]
  }
  return new Date(date as Date).toISOString().split('T')[0]
}

export default function IsaacMode({ onClose }: IsaacModeProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [selectedUploadUserId, setSelectedUploadUserId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // View mode for switching between users and Tim view
  const [viewMode, setViewMode] = useState<ViewMode>('users')
  const [allRequests, setAllRequests] = useState<Request[]>([])
  
  // Edit request state
  const [editingRequest, setEditingRequest] = useState<Request | null>(null)
  const [editForm, setEditForm] = useState({
    startDate: '',
    endDate: '',
    requestType: 'TIME_OFF' as 'WFH' | 'TIME_OFF' | 'BOTH',
    title: '',
    reason: '',
    status: 'APPROVED' as 'PENDING' | 'APPROVED' | 'REJECTED',
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password === '123') {
      setIsAuthenticated(true)
      fetchUsers()
      fetchAllRequests()
    } else {
      setError('Incorrect password')
    }
  }

  const fetchAllRequests = async () => {
    try {
      // Use Isaac Mode endpoint to get all requests without admin auth
      const response = await fetch('/api/isaac-mode/requests', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setAllRequests(data.requests)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/isaac-mode/users', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      } else {
        setError('Failed to fetch users')
      }
    } catch (err) {
      setError('Failed to fetch users')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleUploadClick = (userId: string) => {
    setSelectedUploadUserId(userId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUploadUserId) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please upload an image file (JPEG, PNG, GIF, or WebP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB')
      return
    }

    setUpdatingUserId(selectedUploadUserId)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        throw new Error(uploadError.error || 'Failed to upload image')
      }

      const { url } = await uploadResponse.json()

      const updateResponse = await fetch(`/api/isaac-mode/users/${selectedUploadUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profilePicture: url }),
      })

      if (!updateResponse.ok) {
        const updateError = await updateResponse.json()
        throw new Error(updateError.error || 'Failed to update user')
      }

      const updated = await updateResponse.json()
      setUsers(prev => prev.map(u => (u.id === updated.user.id ? updated.user : u)))
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    } finally {
      setUpdatingUserId(null)
      setSelectedUploadUserId(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteUser = async (userId: string) => {
    const confirmed = window.confirm('Delete this user permanently? This cannot be undone.')
    if (!confirmed) return

    setDeletingUserId(userId)
    setError('')
    try {
      const response = await fetch(`/api/isaac-mode/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }

      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setDeletingUserId(null)
    }
  }

  // Edit request functions (stealth mode - no notifications to Tim)
  const handleStartEdit = (request: Request) => {
    setEditingRequest(request)
    setEditForm({
      startDate: getDateString(request.startDate),
      endDate: getDateString(request.endDate),
      requestType: request.requestType as 'WFH' | 'TIME_OFF' | 'BOTH',
      title: request.title || '',
      reason: request.reason || '',
      status: request.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    })
  }

  const handleCancelEdit = () => {
    setEditingRequest(null)
    setEditForm({
      startDate: '',
      endDate: '',
      requestType: 'TIME_OFF',
      title: '',
      reason: '',
      status: 'APPROVED',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingRequest) return

    setIsSavingEdit(true)
    try {
      const response = await fetch(`/api/isaac-mode/requests/${editingRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          requestType: editForm.requestType,
          title: editForm.title || null,
          reason: editForm.reason || null,
          status: editForm.status,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update request')
      }

      // Refresh requests
      await fetchAllRequests()
      handleCancelEdit()
      alert('✅ Request updated successfully! (No notification sent to Tim)')
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to update request'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    const confirmed = window.confirm('Delete this request permanently? This cannot be undone.')
    if (!confirmed) return

    try {
      const response = await fetch(`/api/isaac-mode/requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete request')
      }

      await fetchAllRequests()
      alert('✅ Request deleted successfully!')
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to delete request'))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden border border-cyan-500/30">
        {/* Header */}
        <div className="p-6 border-b border-cyan-500/30 bg-gradient-to-r from-gray-900 via-cyan-900/20 to-gray-900">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div>
                <h2 className="text-2xl font-bold text-cyan-400">Isaac Mode</h2>
                <p className="text-gray-400 text-sm">Developer Access Panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!isAuthenticated ? (
            /* Password Entry */
            <div className="max-w-md mx-auto py-12">
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🔐</div>
                <h3 className="text-xl font-semibold text-white mb-2">Enter Access Code</h3>
                <p className="text-gray-400 text-sm">This area is restricted to Isaac only</p>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-4 py-3 rounded-lg bg-gray-800 border border-cyan-500/30 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  autoFocus
                />
                
                {error && (
                  <div className="text-red-400 text-sm text-center">{error}</div>
                )}

                <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700">
                  🚀 Access Isaac Mode
                </Button>
              </form>
            </div>
          ) : (
            /* Main Content */
            <div>
              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-cyan-500/30">
                <button
                  onClick={() => setViewMode('users')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    viewMode === 'users'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  👥 Users ({users.length})
                </button>
                <button
                  onClick={() => setViewMode('tim-calendar')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    viewMode === 'tim-calendar'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📅 Tim's Calendar
                </button>
                <button
                  onClick={() => setViewMode('tim-requests')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    viewMode === 'tim-requests'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  📋 Tim's Request View
                </button>
                <button
                  onClick={() => setViewMode('tim-drowning')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    viewMode === 'tim-drowning'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  🏊 Drowning Admin
                </button>
                <button
                  onClick={() => setViewMode('edit-requests')}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    viewMode === 'edit-requests'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  ✏️ Edit Requests (Stealth)
                </button>
              </div>

              {/* View Content */}
              {viewMode === 'users' && (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">
                      All Users ({users.length})
                    </h3>
                    <button
                      onClick={fetchUsers}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                    >
                      🔄 Refresh
                    </button>
                  </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Email</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Password</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Type</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Created</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {user.profilePicture ? (
                                <img
                                  src={user.profilePicture}
                                  alt={user.name}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                                  {user.name[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-white font-medium">{user.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-300 text-sm">{user.email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <code className="text-cyan-400 text-xs bg-gray-800 px-2 py-1 rounded font-mono max-w-[200px] overflow-hidden">
                                {visiblePasswords.has(user.id) 
                                  ? user.password 
                                  : '••••••••••••'
                                }
                              </code>
                              <button
                                onClick={() => togglePasswordVisibility(user.id)}
                                className="text-gray-400 hover:text-cyan-400 transition-colors"
                                title={visiblePasswords.has(user.id) ? 'Hide password' : 'Show password'}
                              >
                                {visiblePasswords.has(user.id) ? '👁️' : '👁️‍🗨️'}
                              </button>
                              <button
                                onClick={() => copyToClipboard(user.password)}
                                className="text-gray-400 hover:text-cyan-400 transition-colors"
                                title="Copy password"
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded ${
                              user.accountType === 'PRODUCER' 
                                ? 'bg-purple-900/50 text-purple-300' 
                                : 'bg-blue-900/50 text-blue-300'
                            }`}>
                              {user.accountType ? user.accountType.toLowerCase() : 'user'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-500 text-xs">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUploadClick(user.id)}
                                className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs"
                                disabled={updatingUserId === user.id}
                                title="Upload profile image"
                              >
                                {updatingUserId === user.id ? 'Uploading...' : '📷 Upload'}
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="px-2.5 py-1 rounded bg-red-900/40 hover:bg-red-900/70 text-red-300 text-xs"
                                disabled={deletingUserId === user.id}
                                title="Delete user"
                              >
                                {deletingUserId === user.id ? 'Deleting...' : '🗑️ Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                <p className="text-yellow-400 text-sm">
                  ⚠️ Note: Passwords shown are bcrypt hashes stored in the database. 
                  The original passwords cannot be recovered from these hashes.
                </p>
              </div>
                </>
              )}

              {/* Tim's Calendar View */}
              {viewMode === 'tim-calendar' && (
                <div className="bg-gray-900/50 rounded-lg p-4 min-h-[600px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-purple-400">📅 Master Calendar (Tim's View) - Edit Mode</h3>
                    <button
                      onClick={() => {
                        fetchAllRequests()
                        // Force calendar refresh by remounting
                        setViewMode('users')
                        setTimeout(() => setViewMode('tim-calendar'), 10)
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                    >
                      🔄 Sync All Data
                    </button>
                  </div>
                  <MasterCalendar 
                    apiEndpoint="/api/isaac-mode/master-calendar" 
                    editable={true}
                    onRequestUpdated={fetchAllRequests}
                  />
                </div>
              )}

              {/* Tim's Request View */}
              {viewMode === 'tim-requests' && (
                <div className="bg-gray-900/50 rounded-lg p-4 min-h-[600px]">
                  <h3 className="text-xl font-semibold text-purple-400 mb-4">📋 Admin Dashboard (Tim's View)</h3>
                  <AdminDashboard
                    requests={allRequests}
                    onRefresh={fetchAllRequests}
                    enableTeamCalendarEdit={true}
                    teamCalendarApiEndpoint="/api/isaac-mode/master-calendar"
                    forceIsaacCode={password}
                  />
                </div>
              )}

              {/* Drowning Admin View */}
              {viewMode === 'tim-drowning' && (
                <div className="bg-gray-900/50 rounded-lg p-4 min-h-[600px]">
                  <h3 className="text-xl font-semibold text-orange-400 mb-4">🏊 Drowning Admin</h3>
                  <DrowningAdmin 
                    apiEndpoint="/api/isaac-mode/drowning" 
                    usersEndpoint="/api/isaac-mode/drowning/users" 
                  />
                </div>
              )}

              {/* Edit Requests View (Stealth Mode) */}
              {viewMode === 'edit-requests' && (
                <div className="bg-gray-900/50 rounded-lg p-4 min-h-[600px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-green-400">✏️ Edit Requests (Stealth Mode)</h3>
                    <button
                      onClick={fetchAllRequests}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  
                  <div className="mb-4 p-3 bg-green-900/30 border border-green-600/30 rounded-lg">
                    <p className="text-green-400 text-sm">
                      🔇 Stealth Mode: Edits made here will NOT notify Tim and will NOT change the request status unless you explicitly change it.
                    </p>
                  </div>

                  {/* Request List */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {allRequests.length === 0 ? (
                      <p className="text-gray-400 text-center py-8">No requests found</p>
                    ) : (
                      allRequests.map((request) => (
                        <div
                          key={request.id}
                          className={`p-4 rounded-lg border ${
                            request.status === 'APPROVED'
                              ? 'bg-green-900/20 border-green-600/30'
                              : request.status === 'PENDING'
                              ? 'bg-yellow-900/20 border-yellow-600/30'
                              : 'bg-red-900/20 border-red-600/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {request.user?.profilePicture ? (
                                <img
                                  src={request.user.profilePicture}
                                  alt={request.user?.name}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold">
                                  {request.user?.name?.[0]?.toUpperCase() || '?'}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-white">{request.user?.name || 'Unknown'}</p>
                                <p className="text-xs text-gray-400">{request.user?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                request.status === 'APPROVED'
                                  ? 'bg-green-600 text-white'
                                  : request.status === 'PENDING'
                                  ? 'bg-yellow-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}>
                                {request.status}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                request.requestType === 'TIME_OFF'
                                  ? 'bg-red-900/50 text-red-300'
                                  : request.requestType === 'WFH'
                                  ? 'bg-blue-900/50 text-blue-300'
                                  : 'bg-purple-900/50 text-purple-300'
                              }`}>
                                {request.requestType === 'TIME_OFF' ? '🏖️ Time Off' : request.requestType === 'WFH' ? '🏠 WFH' : '📅 Both'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-3 text-sm text-gray-300">
                            <p>📅 {new Date(getDateString(request.startDate) + 'T12:00:00').toLocaleDateString()} - {new Date(getDateString(request.endDate) + 'T12:00:00').toLocaleDateString()}</p>
                            {request.title && <p className="mt-1">📝 {request.title}</p>}
                            {request.reason && <p className="mt-1 text-gray-400 text-xs">💬 {request.reason}</p>}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleStartEdit(request)}
                              className="px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(request.id)}
                              className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-white text-xs font-medium"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Edit Modal */}
                  {editingRequest && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                      <div className="bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 border border-green-500/30">
                        <h4 className="text-lg font-semibold text-green-400 mb-4">
                          ✏️ Edit Request for {editingRequest.user?.name}
                        </h4>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={editForm.startDate}
                                onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">End Date</label>
                              <input
                                type="date"
                                value={editForm.endDate}
                                onChange={(e) => setEditForm(prev => ({ ...prev, endDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                              <select
                                value={editForm.requestType}
                                onChange={(e) => setEditForm(prev => ({ ...prev, requestType: e.target.value as any }))}
                                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              >
                                <option value="TIME_OFF">🏖️ Time Off</option>
                                <option value="WFH">🏠 Work From Home</option>
                                <option value="BOTH">📅 Both</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-1">Status</label>
                              <select
                                value={editForm.status}
                                onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value as any }))}
                                className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                              >
                                <option value="APPROVED">✅ Approved</option>
                                <option value="PENDING">⏳ Pending</option>
                                <option value="REJECTED">❌ Rejected</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Title (optional)</label>
                            <input
                              type="text"
                              value={editForm.title}
                              onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="e.g., Vacation, Doctor's appointment..."
                              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm"
                            />
                          </div>

                          <div>
                            <label className="block text-sm text-gray-400 mb-1">Reason (optional)</label>
                            <textarea
                              value={editForm.reason}
                              onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                              placeholder="Additional details..."
                              rows={3}
                              className="w-full px-3 py-2 rounded bg-gray-700 border border-gray-600 text-white text-sm resize-none"
                            />
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="flex-1 px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                            className="flex-1 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                          >
                            {isSavingEdit ? 'Saving...' : '💾 Save (No Notification)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

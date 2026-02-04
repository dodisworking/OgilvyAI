'use client'

import { useState, useEffect } from 'react'
import Button from '../UI/Button'

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

export default function IsaacMode({ onClose }: IsaacModeProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set())

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password === 'Igomoonnnasa') {
      setIsAuthenticated(true)
      fetchUsers()
    } else {
      setError('Incorrect password')
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
            /* Users Table */
            <div>
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">User</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Email</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Password</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Type</th>
                        <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Created</th>
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
                              user.accountType === 'producer' 
                                ? 'bg-purple-900/50 text-purple-300' 
                                : 'bg-blue-900/50 text-blue-300'
                            }`}>
                              {user.accountType || 'user'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-500 text-xs">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

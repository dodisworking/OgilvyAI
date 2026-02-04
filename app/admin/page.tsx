'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminDashboard from '@/components/Admin/AdminDashboard'
import DrowningAdmin from '@/components/Admin/DrowningAdmin'
import MasterCalendar from '@/components/Admin/MasterCalendar'
import Button from '@/components/UI/Button'
import { Request } from '@/types'

type AdminView = 'apps' | 'requests' | 'calendar' | 'drowning'

export default function AdminPage() {
  const [admin, setAdmin] = useState<any>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timModeOpen, setTimModeOpen] = useState(false)
  const [currentView, setCurrentView] = useState<AdminView>('apps')
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userResponse = await fetch('/api/auth/me')
        if (!userResponse.ok) {
          router.push('/')
          return
        }

        const userData = await userResponse.json()
        if (!userData.isAdmin) {
          router.push('/')
          return
        }

        setAdmin(userData.user)
        await fetchRequests()
      } catch (error) {
        console.error('Failed to check auth:', error)
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests')
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
      } else if (response.status === 401) {
        router.push('/')
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout error:', error)
    }
    router.push('/')
    router.refresh()
  }

  const handleRefresh = () => {
    fetchRequests()
  }

  // App bubbles data (same as regular user dashboard)
  const apps = [
    { id: 'time-off', emoji: '⏰', title: 'Time Off / Work From Home', description: 'Request time off or work from home days', available: true },
    { id: 'drowning', emoji: '🆘', title: "I'm Drowning", description: 'Request help when you\'re overwhelmed', available: true },
    { id: 'virtual-office', emoji: '🏢', title: 'WFH Virtual Office', description: 'Join the virtual office and connect with your team', available: false },
    { id: 'scheduler', emoji: '🤖', title: 'AI Production Scheduler', description: 'Create and manage production schedules with AI', available: true },
    { id: 'talent', emoji: '✨', title: 'Talent Tracker', description: 'Track and manage talent', available: false },
    { id: 'boardomagic', emoji: '🎬', title: 'Boardomagic', description: 'Create storyboards and boardomatics', available: false },
    { id: 'suggestion', emoji: '📥', title: 'Suggestion Box', description: 'Suggestions, bug reports, and feature ideas', available: true },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600 dark:text-gray-300">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center text-white font-semibold text-2xl shadow-md">
              👑
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Welcome back, {admin?.name || 'Tim'}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                You have admin superpowers activated
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {/* Tim Mode Button */}
            <div className="relative">
              <Button
                variant="primary"
                onClick={() => setTimModeOpen(!timModeOpen)}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                👑 Go Tim Mode
              </Button>
              
              {/* Tim Mode Dropdown */}
              {timModeOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <div className="p-2">
                    <button
                      onClick={() => { setCurrentView('calendar'); setTimModeOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        currentView === 'calendar' 
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xl">📅</span>
                      <div>
                        <div className="font-medium">Master Calendar</div>
                        <div className="text-xs text-gray-500">See all team schedules</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setCurrentView('requests'); setTimModeOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        currentView === 'requests' 
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xl">📋</span>
                      <div>
                        <div className="font-medium">View Requests</div>
                        <div className="text-xs text-gray-500">Pending & past requests</div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setCurrentView('drowning'); setTimModeOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        currentView === 'drowning' 
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xl">🆘</span>
                      <div>
                        <div className="font-medium">Drowning Requests</div>
                        <div className="text-xs text-gray-500">Team needs help</div>
                      </div>
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                    <button
                      onClick={() => { setCurrentView('apps'); setTimModeOpen(false); }}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                        currentView === 'apps' 
                          ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-xl">🏠</span>
                      <div>
                        <div className="font-medium">Back to Apps</div>
                        <div className="text-xs text-gray-500">View all tools</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Pending Requests Quick Stats */}
        {currentView === 'apps' && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setCurrentView('requests')}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <span className="text-2xl">⏳</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    {requests.filter(r => r.status === 'PENDING').length}
                  </div>
                  <div className="text-sm text-gray-500">Pending Requests</div>
                </div>
              </div>
            </div>
            <div 
              onClick={() => setCurrentView('calendar')}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-2xl">📅</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    Calendar
                  </div>
                  <div className="text-sm text-gray-500">View team coverage</div>
                </div>
              </div>
            </div>
            <div 
              onClick={() => setCurrentView('drowning')}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-2xl">🆘</span>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-white">
                    Help
                  </div>
                  <div className="text-sm text-gray-500">Drowning requests</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {currentView === 'apps' && (
          <>
            {/* App Bubbles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {apps.map(app => (
                <div
                  key={app.id}
                  className={`
                    relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg 
                    transition-all duration-300 cursor-pointer
                    ${app.available 
                      ? 'hover:shadow-xl hover:scale-[1.02] hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 dark:hover:from-gray-700 dark:hover:to-gray-600' 
                      : 'opacity-60'
                    }
                  `}
                >
                  {!app.available && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-500">
                      In development
                    </div>
                  )}
                  <div className="text-4xl mb-4">{app.emoji}</div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                    {app.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {app.description}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {currentView === 'requests' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">All Requests</h2>
              <Button variant="outline" onClick={() => setCurrentView('apps')}>
                ← Back to Apps
              </Button>
            </div>
            <AdminDashboard requests={requests} onRefresh={handleRefresh} />
          </div>
        )}

        {currentView === 'calendar' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Team Coverage</h2>
              <Button variant="outline" onClick={() => setCurrentView('apps')}>
                ← Back to Apps
              </Button>
            </div>
            <MasterCalendar />
          </div>
        )}

        {currentView === 'drowning' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Drowning Requests</h2>
              <Button variant="outline" onClick={() => setCurrentView('apps')}>
                ← Back to Apps
              </Button>
            </div>
            <DrowningAdmin />
          </div>
        )}
      </div>

      {/* Click outside to close Tim Mode dropdown */}
      {timModeOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setTimModeOpen(false)}
        />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AdminDashboard from '@/components/Admin/AdminDashboard'
import DrowningAdmin from '@/components/Admin/DrowningAdmin'
import MasterCalendar from '@/components/Admin/MasterCalendar'
import Button from '@/components/UI/Button'
import { Request } from '@/types'

export default function AdminPage() {
  const [admin, setAdmin] = useState<any>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showTimeOffRequests, setShowTimeOffRequests] = useState(false)
  const [showMasterCalendar, setShowMasterCalendar] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check authentication and fetch admin data
    const checkAuth = async () => {
      try {
        // Get admin from /api/auth/me
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
      // Cookies are sent automatically with fetch

      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests)
      } else if (response.status === 401) {
        // Session expired or invalid
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
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Welcome back, {admin?.name || 'Tim'}! Manage employee requests
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => {
              setShowTimeOffRequests(!showTimeOffRequests)
              setShowMasterCalendar(false)
            }}
            className={`px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
              showTimeOffRequests
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md border-2 border-purple-200 dark:border-purple-800'
            }`}
          >
            {showTimeOffRequests ? 'Hide' : 'Show'} Time Off Requests
          </button>
          <button
            onClick={() => {
              setShowMasterCalendar(!showMasterCalendar)
              setShowTimeOffRequests(false)
            }}
            className={`px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${
              showMasterCalendar
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:shadow-md border-2 border-purple-200 dark:border-purple-800'
            }`}
          >
            {showMasterCalendar ? 'Hide' : 'Show'} Master Calendar
          </button>
        </div>

        {/* Time Off Requests Dashboard */}
        {showTimeOffRequests && (
          <div className="mb-12">
            <AdminDashboard requests={requests} onRefresh={handleRefresh} />
          </div>
        )}

        {/* Master Calendar */}
        {showMasterCalendar && (
          <div className="mb-12">
            <MasterCalendar requests={requests} />
          </div>
        )}

        {/* Drowning Requests Section */}
        <div className="mt-12">
          <DrowningAdmin />
        </div>
      </div>

    </div>
  )
}
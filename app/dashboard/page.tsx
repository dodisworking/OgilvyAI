'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import MenuBubble from '@/components/Dashboard/MenuBubble'
import InteractiveCalendar from '@/components/Dashboard/InteractiveCalendar'
import RequestList from '@/components/Dashboard/RequestList'
import ChangePasswordForm from '@/components/Dashboard/ChangePasswordForm'
import ProfileSettings from '@/components/Dashboard/ProfileSettings'
import ProfileSetupPrompt from '@/components/Dashboard/ProfileSetupPrompt'
import IsaacMode from '@/components/Dashboard/IsaacMode'
import DrowningCalendar from '@/components/Dashboard/DrowningCalendar'
import DrowningRequestList from '@/components/Dashboard/DrowningRequestList'
import VirtualOffice from '@/components/VirtualOffice/VirtualOffice'
import ProductionScheduleMaker from '@/components/Dashboard/ProductionScheduleMaker'
import BoardomagicMain from '@/components/Dashboard/Boardomagic/BoardomagicMain'
import Button from '@/components/UI/Button'
import { Request } from '@/types'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [requests, setRequests] = useState<Request[]>([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [showRequests, setShowRequests] = useState(false)
  const [showDrowningCalendar, setShowDrowningCalendar] = useState(false)
  const [showDrowningRequests, setShowDrowningRequests] = useState(false)
  const [showVirtualOffice, setShowVirtualOffice] = useState(false)
  const [showProductionSchedule, setShowProductionSchedule] = useState(false)
  const [showBoardomagic, setShowBoardomagic] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showProfileSettings, setShowProfileSettings] = useState(false)
  const [showIsaacMode, setShowIsaacMode] = useState(false)
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [profileSetupDismissed, setProfileSetupDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check authentication and fetch user data
    const checkAuth = async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:35',message:'Dashboard auth check started',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Get user from /api/auth/me with credentials
        const userResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        })
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:38',message:'Auth check response received',data:{status:userResponse.status,ok:userResponse.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (!userResponse.ok) {
          // #region agent log
          fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:40',message:'Auth check failed - redirecting to login',data:{status:userResponse.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          router.push('/')
          return
        }

        const userData = await userResponse.json()
        
        // Check if user is admin (shouldn't be on dashboard)
        if (userData.isAdmin) {
          router.push('/admin')
          return
        }
        
        setUser(userData.user)
        await fetchRequests()
      } catch (error) {
        console.error('Failed to check auth:', error)
        // #region agent log
        fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/dashboard/page.tsx:54',message:'Auth check error - redirecting to login',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (!user || profileSetupDismissed) return

    const missingProfilePicture = !user.profilePicture
    const missingRole = !user.accountType

    if (missingProfilePicture || missingRole) {
      setShowProfileSetup(true)
    }
  }, [user, profileSetupDismissed])

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests', {
        credentials: 'include',
      })
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

  const handleDatesSelected = async (dateRanges: {
    startDate: Date
    endDate: Date
    requestType: 'TIME_OFF' | 'WFH' | 'BOTH'
    title?: string
    reason?: string
    dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'>
  }[]) => {
    setIsSubmitting(true)
    try {
      // Submit each date range as a separate request
      const promises = dateRanges.map(async (range) => {
        try {
          const response = await fetch('/api/requests', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              startDate: range.startDate.toISOString(),
              endDate: range.endDate.toISOString(),
              requestType: range.requestType,
              title: range.title || null,
              reason: range.reason || null,
              dayBreakdown: range.dayBreakdown && Object.keys(range.dayBreakdown).length > 0 ? range.dayBreakdown : null,
            }),
          })
          return { ok: response.ok, status: response.status, response }
        } catch (fetchError: any) {
          console.error('Fetch error:', fetchError)
          throw new Error(`Network error: ${fetchError.message || 'Failed to connect to server. Make sure the server is running.'}`)
        }
      })

      const results = await Promise.all(promises)
      const errors = []

      for (const result of results) {
        if (!result.ok) {
          try {
            const errorData = await result.response.json()
            console.error('Request submission error:', errorData)
            errors.push(errorData.error || `Failed to submit request (${result.status})`)
          } catch (parseError) {
            console.error('Failed to parse error response:', parseError)
            errors.push(`Failed to submit request (${result.status})`)
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(', '))
      }

      // Refresh requests
      await fetchRequests()
      
      // Show success animation
      setShowSuccess(true)
      
      // Hide success animation after 3 seconds
      setTimeout(() => {
        setShowSuccess(false)
      }, 3000)
      
      setShowCalendar(false)
    } catch (error: any) {
      console.error('Error submitting requests:', error)
      alert(error.message || 'Failed to submit requests. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
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
          <div className="flex items-center gap-4">
            {/* Clickable Profile Picture */}
            <div 
              onClick={() => setShowProfileSettings(true)}
              className="relative cursor-pointer group"
            >
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user?.name || 'User'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-purple-300 shadow-md group-hover:border-purple-500 transition-all"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-2xl shadow-md group-hover:from-purple-500 group-hover:to-pink-500 transition-all">
                  {(user?.name || 'U')[0].toUpperCase()}
                </div>
              )}
              {/* Settings indicator */}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs">⚙️</span>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">welcome to isaacs ai mind that hopefully will make your life easier</p>
            </div>
          </div>
          <div className="flex gap-3">
            {/* Isaac Mode Button - only for Isaac */}
            {user?.email === 'isaac.boruchowicz@ogilvy.com' && (
              <button
                onClick={() => setShowIsaacMode(true)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-lg"
              >
                🚀 Go Isaac Mode
              </button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Menu Bubbles - uniform app size (all same height) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 grid-auto-rows-[minmax(200px,200px)]">
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="Time Off / Work From Home"
              description="Request time off or work from home days"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-200 to-blue-200 dark:from-red-900/30 dark:to-blue-900/30 mx-auto flex items-center justify-center text-2xl">⏰</div>}
              onClick={() => {}}
              gradient="bg-gradient-to-r from-purple-500 to-pink-500"
            />
            {/* Dropdown menu on hover */}
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 z-10">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 space-y-2 border-2 border-purple-200 dark:border-purple-800">
                <button
                  onClick={() => {
                    setShowCalendar(true)
                    setShowRequests(false)
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium text-sm"
                >
                  Submit Time
                </button>
                <button
                  onClick={() => {
                    setShowRequests(true)
                    setShowCalendar(false)
                  }}
                  className="w-full px-4 py-3 rounded-lg border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all font-medium text-sm"
                >
                  Review Submissions
                </button>
              </div>
            </div>
          </div>

          {/* I'm Drowning Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="🆘 I'm Drowning"
              description="Request help when you're overwhelmed"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-300 to-cyan-400 dark:from-blue-600 dark:to-cyan-700 mx-auto flex items-center justify-center text-2xl">🆘</div>}
              onClick={() => {}}
              gradient="bg-gradient-to-r from-blue-500 to-cyan-500"
            />
            {/* Dropdown menu on hover */}
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 z-10">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 space-y-2 border-2 border-blue-200 dark:border-blue-800">
                <button
                  onClick={() => {
                    setShowDrowningCalendar(true)
                    setShowDrowningRequests(false)
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transition-all font-medium text-sm"
                >
                  🆘 Request Rescue
                </button>
                <button
                  onClick={() => {
                    setShowDrowningRequests(true)
                    setShowDrowningCalendar(false)
                  }}
                  className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all font-medium text-sm"
                >
                  🚑 See Who Needs Your Rescue
                </button>
              </div>
            </div>
          </div>

          {/* WFH Virtual Office Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="🏢 WFH Virtual Office"
              description="Join the virtual office and connect with your team"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-300 to-purple-400 dark:from-indigo-600 dark:to-purple-700 mx-auto flex items-center justify-center text-2xl">🏢</div>}
              onClick={() => {
                setShowVirtualOffice(true)
                setShowCalendar(false)
                setShowRequests(false)
                setShowDrowningCalendar(false)
                setShowDrowningRequests(false)
              }}
              gradient="bg-gradient-to-r from-indigo-500 to-purple-500"
              inDevelopment
            />
          </div>

          {/* AI Production Scheduler Maker Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="🤖 AI Production Scheduler Maker"
              description="Create and manage production schedules with AI"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-300 to-teal-400 dark:from-green-600 dark:to-teal-700 mx-auto flex items-center justify-center text-2xl">🤖</div>}
              onClick={() => {}}
              gradient="bg-gradient-to-r from-green-500 to-teal-500"
            />
            {/* Dropdown menu on hover */}
            <div className="absolute top-full left-0 right-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform group-hover:translate-y-0 translate-y-2 z-10">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-4 space-y-2 border-2 border-green-200 dark:border-green-800">
                <button
                  onClick={() => {
                    setShowProductionSchedule(true)
                    setShowCalendar(false)
                    setShowRequests(false)
                    setShowDrowningCalendar(false)
                    setShowDrowningRequests(false)
                    setShowVirtualOffice(false)
                    setShowBoardomagic(false)
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-green-600 to-teal-600 text-white hover:from-green-700 hover:to-teal-700 transition-all font-medium text-sm"
                >
                  🤖 Open AI Scheduler
                </button>
              </div>
            </div>
          </div>

          {/* Talent Tracker Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="✨ Talent Tracker"
              description="Track and manage talent"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-violet-300 to-fuchsia-400 dark:from-violet-600 dark:to-fuchsia-700 mx-auto flex items-center justify-center text-2xl">✨</div>}
              onClick={() => router.push('/talent-tracker')}
              gradient="bg-gradient-to-r from-violet-500 to-fuchsia-500"
              inDevelopment
            />
          </div>

          {/* Boardomagic Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="🎬 Boardomagic"
              description="Create storyboards and boardomatics"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-orange-300 to-red-400 dark:from-orange-600 dark:to-red-700 mx-auto flex items-center justify-center text-2xl">🎬</div>}
              onClick={() => {
                setShowBoardomagic(true)
                setShowCalendar(false)
                setShowRequests(false)
                setShowDrowningCalendar(false)
                setShowDrowningRequests(false)
                setShowVirtualOffice(false)
                setShowProductionSchedule(false)
              }}
              gradient="bg-gradient-to-r from-orange-500 to-red-500"
              inDevelopment
            />
          </div>

          {/* Face Match (AI Talent Recognition) Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="👤 Face Match"
              description="AI talent recognition — match faces to talent reports"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-300 to-blue-400 dark:from-cyan-600 dark:to-blue-700 mx-auto flex items-center justify-center text-2xl">👤</div>}
              onClick={() => router.push('/face-match')}
              gradient="bg-gradient-to-r from-cyan-500 to-blue-500"
              inDevelopment
            />
          </div>

          {/* Folder Flow (AI Folder Organizer) Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="📁 Folder Flow"
              description="AI folder organizer assistant"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-300 to-teal-400 dark:from-emerald-600 dark:to-teal-700 mx-auto flex items-center justify-center text-2xl">📁</div>}
              onClick={() => router.push('/folder-flow')}
              gradient="bg-gradient-to-r from-emerald-500 to-teal-500"
              inDevelopment
            />
          </div>

          {/* Walk In the Ballpark Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="⚾ Walk In the Ballpark"
              description="AI assistant for fast estimates"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 dark:from-amber-600 dark:to-orange-700 mx-auto flex items-center justify-center text-2xl">⚾</div>}
              onClick={() => router.push('/walk-in-the-ballpark')}
              gradient="bg-gradient-to-r from-amber-500 to-orange-500"
              inDevelopment
            />
          </div>

          {/* Link Sorter Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="🔗 Link Sorter"
              description="Production links sorted with AI — call on them quickly"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-rose-300 to-pink-400 dark:from-rose-600 dark:to-pink-700 mx-auto flex items-center justify-center text-2xl">🔗</div>}
              onClick={() => router.push('/link-sorter')}
              gradient="bg-gradient-to-r from-rose-500 to-pink-500"
              inDevelopment
            />
          </div>

          {/* I Play Chess You Play Check Off (Shot Tracker) Bubble */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="✅ I Play Chess, You Play Check Off"
              description="Live shot list tracker — everyone sees progress during production"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-300 to-slate-400 dark:from-indigo-600 dark:to-slate-700 mx-auto flex items-center justify-center text-2xl">✅</div>}
              onClick={() => router.push('/shot-tracker')}
              gradient="bg-gradient-to-r from-indigo-500 to-slate-500"
              inDevelopment
            />
          </div>

          {/* Suggestion Box Bubble - at bottom */}
          <div className="relative group h-full min-h-[200px] flex w-full">
            <MenuBubble
              title="📥 Suggestion Box"
              description="Suggestions, bug reports, and feature ideas"
              icon={<div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-300 to-yellow-400 dark:from-amber-600 dark:to-yellow-700 mx-auto flex items-center justify-center text-2xl">📥</div>}
              onClick={() => router.push('/suggestion-box')}
              gradient="bg-gradient-to-r from-amber-500 to-yellow-500"
            />
          </div>
        </div>

      </div>

      {showChangePassword && (
        <ChangePasswordForm onClose={() => setShowChangePassword(false)} />
      )}

      {/* Profile Settings Modal */}
      {showProfileSettings && user && (
        <ProfileSettings
          user={user}
          onClose={() => setShowProfileSettings(false)}
          onProfileUpdate={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {showProfileSetup && user && (
        <ProfileSetupPrompt
          userName={user.name || 'there'}
          onComplete={(data) => {
            setUser((prev: any) => ({
              ...prev,
              profilePicture: data.profilePicture,
              accountType: data.accountType,
            }))
            setShowProfileSetup(false)
          }}
          onSkip={() => {
            setProfileSetupDismissed(true)
            setShowProfileSetup(false)
          }}
        />
      )}

      {/* Isaac Mode Modal */}
      {showIsaacMode && (
        <IsaacMode onClose={() => setShowIsaacMode(false)} />
      )}

      {/* Submit Time Modal */}
      {showCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => setShowCalendar(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4">Submit Time</h2>
            <InteractiveCalendar
              userName={user?.name || ''}
              onDatesSelected={handleDatesSelected}
              onCancel={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* Review Submissions Modal */}
      {showRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => setShowRequests(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-6">Your Requests</h2>
            <RequestList requests={requests} onUpdate={fetchRequests} />
          </div>
        </div>
      )}

      {/* I'm Drowning Modal */}
      {showDrowningCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => setShowDrowningCalendar(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>
            <h2 className="text-xl font-bold mb-4 text-blue-600 dark:text-blue-400">🆘 I&apos;m Drowning</h2>
            <DrowningCalendar
              userName={user?.name || ''}
              onDatesSelected={async (data) => {
                setIsSubmitting(true)
                try {
                  const response = await fetch('/api/drowning', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                      startDate: data.startDate.toISOString(),
                      endDate: data.endDate.toISOString(),
                      natureOfNeed: data.natureOfNeed,
                      dayBreakdown: data.dayBreakdown,
                      sendToAll: data.sendToAll,
                    }),
                  })

                  if (response.ok) {
                    const result = await response.json()
                    setShowDrowningCalendar(false)
                    if (data.sendToAll) {
                      setShowSuccess(true)
                      setTimeout(() => setShowSuccess(false), 3000)
                    } else {
                      setShowSuccess(true)
                      setTimeout(() => setShowSuccess(false), 3000)
                    }
                  } else {
                    const errorData = await response.json()
                    alert(errorData.error || 'Failed to submit drowning request')
                  }
                } catch (error) {
                  console.error('Failed to submit drowning request:', error)
                  alert('Failed to submit drowning request. Please try again.')
                } finally {
                  setIsSubmitting(false)
                }
              }}
              onCancel={() => setShowDrowningCalendar(false)}
            />
          </div>
        </div>
      )}

      {/* See Who Needs Your Rescue Modal */}
      {showDrowningRequests && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8 relative my-8 animate-in zoom-in duration-300">
            <DrowningRequestList onClose={() => setShowDrowningRequests(false)} />
          </div>
        </div>
      )}

      {/* Virtual Office Modal */}
      {showVirtualOffice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-7xl w-full p-8 relative my-8 animate-in zoom-in duration-300">
            <button
              onClick={() => setShowVirtualOffice(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>
            <VirtualOffice />
          </div>
        </div>
      )}

      {/* AI Production Schedule Maker Modal */}
      {showProductionSchedule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col relative my-4 animate-in zoom-in duration-300">
            <button
              onClick={() => setShowProductionSchedule(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl z-20 bg-white dark:bg-gray-800 rounded-full w-8 h-8 flex items-center justify-center shadow-md"
            >
              ×
            </button>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <ProductionScheduleMaker />
            </div>
          </div>
        </div>
      )}

      {/* Boardomagic Modal */}
      {showBoardomagic && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-7xl w-full h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] flex flex-col relative animate-in zoom-in duration-300">
            <button
              onClick={() => setShowBoardomagic(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
            >
              ×
            </button>
            <div className="flex-1 overflow-hidden min-h-0">
              <BoardomagicMain onClose={() => setShowBoardomagic(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-4"></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Submitting Request...</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                Please wait while we submit your time off request
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Overlay */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all scale-100">
            <div className="flex flex-col items-center">
              <div className="mb-4 animate-bounce">
                <svg
                  className="w-16 h-16 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Success!</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
                Your request has been submitted successfully. Tim will be notified!
              </p>
              <button
                onClick={() => setShowSuccess(false)}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths, getDay, isWeekend } from 'date-fns'
import { Request } from '@/types'

interface UserSchedule {
  userId: string
  userName: string
  profilePicture?: string | null
  requests: {
    id: string
    startDate: string
    endDate: string
    requestType: 'WFH' | 'TIME_OFF' | 'BOTH'
    status: string
    dayBreakdown?: Record<string, string>
  }[]
}

interface PendingRequest {
  userName: string
  profilePicture?: string | null
  startDate: string
  endDate: string
  requestType: 'WFH' | 'TIME_OFF' | 'BOTH'
  dayBreakdown?: Record<string, string>
}

interface MasterCalendarProps {
  initialMonth?: Date
  pendingRequest?: PendingRequest
  apiEndpoint?: string // Optional custom API endpoint for Isaac Mode
  updateEndpoint?: string // Endpoint prefix for updating requests by id
  editable?: boolean // Enable editing mode (Isaac Mode)
  showEditButton?: boolean // Show top-right edit/lock button
  allowPendingApproval?: boolean // Allow approving pending requests inline
  onRequestUpdated?: () => void // Callback when a request is updated
  requestsData?: Request[] // Optional data source to keep calendar linked to existing requests
  /** Embedded in Tim App iPhone sheet: tighter chrome + fit zoom */
  compact?: boolean
}

interface EditingRequest {
  requestId: string
  userId: string
  userName: string
  startDate: string
  endDate: string
  requestType: 'WFH' | 'TIME_OFF' | 'BOTH'
  status: string
}

export default function MasterCalendar({
  initialMonth,
  pendingRequest,
  apiEndpoint,
  updateEndpoint = '/api/isaac-mode/requests',
  editable = false,
  showEditButton = false,
  allowPendingApproval = false,
  onRequestUpdated,
  requestsData,
  compact = false,
}: MasterCalendarProps = {}) {
  const [currentMonth, setCurrentMonth] = useState(initialMonth || new Date())
  const [userSchedules, setUserSchedules] = useState<UserSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  
  // Zoom state - 'fit' means fit all days on screen without scrolling
  const [zoomLevel, setZoomLevel] = useState<'fit' | 'small' | 'medium' | 'large'>('fit')
  const zoomWidths = { fit: 0, small: 10, medium: 14, large: 20 }
  const cellWidth = zoomWidths[zoomLevel]
  const useFitMode = zoomLevel === 'fit'
  
  // Editing state
  const [editingRequest, setEditingRequest] = useState<EditingRequest | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editType, setEditType] = useState<'WFH' | 'TIME_OFF' | 'BOTH'>('TIME_OFF')
  const [editStatus, setEditStatus] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('APPROVED')
  const [isSaving, setIsSaving] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  
  // Drag state
  const [draggedRequest, setDraggedRequest] = useState<{ userId: string; requestId: string; type: 'WFH' | 'TIME_OFF' } | null>(null)
  
  // Helper to parse date string to local date (avoiding timezone issues)
  const parseLocalDate = (dateStr: string) => {
    // Extract just the date part (YYYY-MM-DD) and create date at noon local time
    const datePart = dateStr.split('T')[0]
    return new Date(datePart + 'T12:00:00')
  }
  const canEdit = editable || isEditMode

  const buildSchedulesFromRequests = (requests: Request[]): UserSchedule[] => {
    const groupedByUser = new Map<string, UserSchedule>()

    requests
      .filter((request) => request.status === 'APPROVED' || request.status === 'PENDING')
      .forEach((request) => {
        const userId = request.userId
        const existing = groupedByUser.get(userId)

        const mappedRequest = {
          id: request.id,
          startDate: typeof request.startDate === 'string' ? request.startDate : new Date(request.startDate).toISOString(),
          endDate: typeof request.endDate === 'string' ? request.endDate : new Date(request.endDate).toISOString(),
          requestType: request.requestType,
          status: request.status,
          dayBreakdown: request.dayBreakdown as Record<string, string> | undefined,
        }

        if (existing) {
          existing.requests.push(mappedRequest)
          return
        }

        groupedByUser.set(userId, {
          userId,
          userName: request.user?.name || 'Unknown User',
          profilePicture: request.user?.profilePicture || null,
          requests: [mappedRequest],
        })
      })

    return Array.from(groupedByUser.values())
  }

  useEffect(() => {
    if (requestsData) {
      setUserSchedules(buildSchedulesFromRequests(requestsData))
      setIsLoading(false)
      return
    }

    fetchAllSchedules()
  }, [apiEndpoint, requestsData]) // Refetch if endpoint or source data changes

  useEffect(() => {
    if (compact) setZoomLevel('fit')
  }, [compact])

  const fetchAllSchedules = async () => {
    setIsLoading(true)
    try {
      const endpoint = apiEndpoint || '/api/admin/master-calendar'
      const response = await fetch(endpoint, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setUserSchedules(data.schedules)
      }
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Find request by userId and date
  const findRequestForDate = (userId: string, dateStr: string) => {
    const user = userSchedules.find(u => u.userId === userId)
    if (!user) return null
    
    return user.requests.find(req => {
      const start = new Date(req.startDate)
      const end = new Date(req.endDate)
      const checkDate = new Date(dateStr)
      return checkDate >= start && checkDate <= end
    })
  }

  // Handle clicking on a request bar to edit
  const handleRequestClick = (userId: string, dateStr: string, userName: string) => {
    const request = findRequestForDate(userId, dateStr)
    if (!request) return
    if (!canEdit && !(allowPendingApproval && request.status === 'PENDING')) return

    setEditingRequest({
      requestId: request.id,
      userId,
      userName,
      startDate: request.startDate,
      endDate: request.endDate,
      requestType: request.requestType,
      status: request.status,
    })
    // Extract date part directly from ISO string to avoid timezone issues
    setEditStartDate(request.startDate.split('T')[0])
    setEditEndDate(request.endDate.split('T')[0])
    setEditType(request.requestType)
    setEditStatus(request.status as 'PENDING' | 'APPROVED' | 'REJECTED')
  }

  // Save edited request
  const handleSaveEdit = async () => {
    if (!editingRequest) return

    setIsSaving(true)
    try {
      const response = await fetch(`${updateEndpoint}/${editingRequest.requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startDate: editStartDate,
          endDate: editEndDate,
          requestType: editType,
          status: editStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update request')
      }

      // Refresh calendar
      await fetchAllSchedules()
      setEditingRequest(null)
      onRequestUpdated?.()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to update request'))
    } finally {
      setIsSaving(false)
    }
  }

  // Handle drag start
  const handleDragStart = (userId: string, requestId: string, type: 'WFH' | 'TIME_OFF') => {
    if (!editable) return
    setDraggedRequest({ userId, requestId, type })
  }

  // Handle drop on a date
  const handleDrop = async (targetDate: string, targetUserId: string) => {
    if (!draggedRequest || !canEdit) return
    if (draggedRequest.userId !== targetUserId) {
      setDraggedRequest(null)
      return // Can't move requests between users
    }

    const request = userSchedules
      .find(u => u.userId === draggedRequest.userId)
      ?.requests.find(r => r.id === draggedRequest.requestId)
    
    if (!request) {
      setDraggedRequest(null)
      return
    }

    // Calculate new dates (shift by the difference)
    const oldStart = new Date(request.startDate)
    const oldEnd = new Date(request.endDate)
    const duration = Math.floor((oldEnd.getTime() - oldStart.getTime()) / (1000 * 60 * 60 * 24))
    
    const newStart = new Date(targetDate)
    const newEnd = new Date(newStart)
    newEnd.setDate(newEnd.getDate() + duration)

    try {
      const response = await fetch(`${updateEndpoint}/${draggedRequest.requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          startDate: newStart.toISOString().split('T')[0],
          endDate: newEnd.toISOString().split('T')[0],
          requestType: request.requestType,
          status: request.status,
        }),
      })

      if (response.ok) {
        await fetchAllSchedules()
        onRequestUpdated?.()
      }
    } catch (err) {
      console.error('Failed to move request:', err)
    } finally {
      setDraggedRequest(null)
    }
  }

  const handleApprovePending = async () => {
    if (!editingRequest || editingRequest.status !== 'PENDING') return

    setIsApproving(true)
    try {
      const response = await fetch('/api/requests/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          requestId: editingRequest.requestId,
          status: 'APPROVED',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to approve request')
      }

      await fetchAllSchedules()
      setEditingRequest(null)
      onRequestUpdated?.()
    } catch (err: any) {
      alert(err.message || 'Failed to approve request')
    } finally {
      setIsApproving(false)
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get users who have any approved or pending requests
  const activeUsers = useMemo(() => {
    return userSchedules.filter(user => 
      user.requests.some(req => req.status === 'APPROVED' || req.status === 'PENDING')
    )
  }, [userSchedules])

  // Build a map of userId -> date -> { type, status }
  const userDateMap = useMemo(() => {
    const map: Record<string, Record<string, { type: 'WFH' | 'TIME_OFF', status: string }>> = {}
    
    userSchedules.forEach(user => {
      map[user.userId] = {}
      user.requests.forEach(request => {
        if (request.status !== 'APPROVED' && request.status !== 'PENDING') return
        
        // Use parseLocalDate to avoid timezone issues
        const start = parseLocalDate(request.startDate)
        const end = parseLocalDate(request.endDate)
        const days = eachDayOfInterval({ start, end })
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          let dayType = request.requestType
          if (request.dayBreakdown && request.dayBreakdown[dateStr]) {
            dayType = request.dayBreakdown[dateStr] as 'WFH' | 'TIME_OFF'
          }
          const finalType = dayType === 'BOTH' ? 'TIME_OFF' : dayType as 'WFH' | 'TIME_OFF'
          
          // Only overwrite if no entry exists, or if current is approved (approved takes priority)
          if (!map[user.userId][dateStr] || request.status === 'APPROVED') {
            map[user.userId][dateStr] = { type: finalType, status: request.status }
          }
        })
      })
    })
    
    return map
  }, [userSchedules])

  // Get all events for a specific day
  const getEventsForDay = (dateStr: string) => {
    const events: { user: UserSchedule, type: 'WFH' | 'TIME_OFF', status: string }[] = []
    activeUsers.forEach(user => {
      const entry = userDateMap[user.userId]?.[dateStr]
      if (entry) {
        events.push({ user, type: entry.type, status: entry.status })
      }
    })
    return events
  }

  const selectedDayData = selectedDay ? getEventsForDay(selectedDay) : null

  const stickyNameCol = compact
    ? 'w-24 min-w-[96px] flex-shrink-0 p-1'
    : 'w-36 min-w-[144px] flex-shrink-0 p-2'

  // Build pending request date map
  const pendingDates = useMemo(() => {
    if (!pendingRequest) return new Map<string, 'WFH' | 'TIME_OFF'>()
    
    const map = new Map<string, 'WFH' | 'TIME_OFF'>()
    const start = parseLocalDate(pendingRequest.startDate)
    const end = parseLocalDate(pendingRequest.endDate)
    const days = eachDayOfInterval({ start, end })
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd')
      let dayType = pendingRequest.requestType
      if (pendingRequest.dayBreakdown && pendingRequest.dayBreakdown[dateStr]) {
        dayType = pendingRequest.dayBreakdown[dateStr] as 'WFH' | 'TIME_OFF' | 'BOTH'
      }
      map.set(dateStr, dayType === 'BOTH' ? 'TIME_OFF' : dayType as 'WFH' | 'TIME_OFF')
    })
    
    return map
  }, [pendingRequest])

  return (
    <div
      className={`flex flex-col bg-white dark:bg-gray-800 ${
        compact
          ? 'max-h-full min-h-0 rounded-lg shadow-none'
          : 'max-h-[calc(100vh-250px)] rounded-2xl shadow-xl'
      }`}
    >
      {/* Header */}
      <div
        className={`flex-shrink-0 border-b border-gray-200 dark:border-gray-700 ${
          compact ? 'p-2' : 'p-4'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className={`font-bold text-gray-800 dark:text-white ${
              compact ? 'text-sm' : 'text-xl'
            }`}
          >
            Team Coverage Calendar
          </h2>
          <div className={`flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-2'}`}>
            {showEditButton && (
              <button
                onClick={() => setIsEditMode((prev) => !prev)}
                className={`rounded-lg font-medium transition-colors ${
                  isEditMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                } ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`}
              >
                {isEditMode ? 'Lock Calendar' : 'Edit Calendar'}
              </button>
            )}
            {/* Zoom Controls */}
            {!compact && (
              <div className="mr-2 flex items-center gap-1 border-r border-gray-300 pr-2 dark:border-gray-600">
                <span className="text-xs text-gray-500 dark:text-gray-400">View:</span>
                <button
                  onClick={() => setZoomLevel('fit')}
                  className={`rounded px-2 py-1 text-xs ${zoomLevel === 'fit' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  title="Fit all days on screen"
                >
                  Fit
                </button>
                <button
                  onClick={() => setZoomLevel('small')}
                  className={`rounded px-2 py-1 text-xs ${zoomLevel === 'small' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  title="Small cells"
                >
                  S
                </button>
                <button
                  onClick={() => setZoomLevel('medium')}
                  className={`rounded px-2 py-1 text-xs ${zoomLevel === 'medium' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  title="Medium cells"
                >
                  M
                </button>
                <button
                  onClick={() => setZoomLevel('large')}
                  className={`rounded px-2 py-1 text-xs ${zoomLevel === 'large' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
                  title="Large cells"
                >
                  L
                </button>
              </div>
            )}
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className={`rounded-lg bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 ${
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              }`}
            >
              {compact ? '←' : '← Prev'}
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className={`rounded-lg bg-purple-100 font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800 ${
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className={`rounded-lg bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 ${
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              }`}
            >
              {compact ? '→' : 'Next →'}
            </button>
          </div>
        </div>
        <h3
          className={`mt-2 text-center font-semibold text-gray-700 dark:text-gray-200 ${
            compact ? 'text-sm' : 'text-lg'
          }`}
        >
          {format(currentMonth, 'MMMM yyyy')}
        </h3>

        {/* Legend */}
        <div
          className={`mt-3 flex flex-wrap justify-center ${compact ? 'gap-2 text-[10px]' : 'gap-6 text-xs'}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Time Off (Approved)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-gray-600 dark:text-gray-400">WFH (Approved)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-400 border-2 border-dashed border-orange-600"></div>
            <span className="text-orange-600 dark:text-orange-400">Time Off (Pending)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-cyan-400 border-2 border-dashed border-cyan-600"></div>
            <span className="text-cyan-600 dark:text-cyan-400">WFH (Pending)</span>
          </div>
          {pendingRequest && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400 border-2 border-yellow-600"></div>
              <span className="text-yellow-700 dark:text-yellow-400 font-medium">Your Request</span>
            </div>
          )}
        </div>
      </div>

      {/* Gantt-style Calendar */}
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <span className="text-4xl mb-3">🎉</span>
            <p className="font-medium">No scheduled time off this month</p>
            <p className="text-sm">Everyone is available!</p>
          </div>
        ) : (
          <div className="min-w-max">
            {/* Day headers row */}
            <div className="flex sticky top-0 bg-white dark:bg-gray-800 z-20 border-b border-gray-200 dark:border-gray-700">
              <div
                className={`${stickyNameCol} sticky left-0 z-30 border-r border-gray-200 bg-white font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 ${
                  compact ? 'text-[10px]' : 'text-sm'
                }`}
              >
                Team Member
              </div>
              <div className="flex flex-1">
                {daysInMonth.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  const isWeekendDay = isWeekend(day)
                  const isTodayDay = isToday(day)
                  const isPendingDay = pendingDates.has(dateStr)
                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                      style={useFitMode ? {} : { width: `${cellWidth * 4}px` }}
                      className={`${useFitMode ? 'flex-1 min-w-0' : 'flex-shrink-0'} p-0.5 text-center cursor-pointer border-r border-gray-300 dark:border-gray-600 ${
                        isPendingDay
                          ? 'bg-yellow-200 dark:bg-yellow-800/40'
                          : isTodayDay 
                          ? 'bg-purple-100 dark:bg-purple-900/30' 
                          : isWeekendDay 
                          ? 'bg-gray-100 dark:bg-gray-700/50' 
                          : ''
                      }`}
                    >
                      <div className={`${useFitMode ? 'text-[7px]' : zoomLevel === 'small' ? 'text-[8px]' : 'text-[10px]'} text-gray-500 dark:text-gray-400 truncate`}>
                        {useFitMode ? format(day, 'EEEEE') : zoomLevel === 'small' ? format(day, 'EEEEE') : format(day, 'EEE')}
                      </div>
                      <div className={`${useFitMode ? 'text-[9px]' : zoomLevel === 'small' ? 'text-xs' : 'text-sm'} font-medium ${isPendingDay ? 'text-yellow-700 font-bold' : isTodayDay ? 'text-purple-600' : 'text-gray-700 dark:text-gray-300'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Pending Request Row - Show at top if exists */}
            {pendingRequest && (
              <div className="flex border-b-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
                {/* User name with profile picture - STICKY */}
                <div
                  className={`${stickyNameCol} sticky left-0 z-10 flex items-center border-r border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 ${
                    compact ? 'gap-1' : 'gap-2'
                  }`}
                >
                  {pendingRequest.profilePicture ? (
                    <img 
                      src={pendingRequest.profilePicture} 
                      alt={pendingRequest.userName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-yellow-500"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {pendingRequest.userName[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-yellow-700 dark:text-yellow-300 truncate">
                      {pendingRequest.userName}
                    </span>
                    <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
                      ⏳ PENDING
                    </span>
                  </div>
                </div>
                
                {/* Day cells with pending bars */}
                <div className="flex flex-1">
                  {daysInMonth.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const pendingType = pendingDates.get(dateStr)
                    const isWeekendDay = isWeekend(day)
                    const isTodayDay = isToday(day)
                    
                    return (
                      <div
                        key={dateStr}
                        style={useFitMode ? { height: '32px' } : { width: `${cellWidth * 4}px`, height: `${cellWidth * 3}px` }}
                        className={`${useFitMode ? 'flex-1 min-w-0' : 'flex-shrink-0'} flex items-center justify-center p-0.5 border-r border-gray-300 dark:border-gray-600 ${
                          isTodayDay 
                            ? 'bg-purple-50 dark:bg-purple-900/20' 
                            : isWeekendDay 
                            ? 'bg-gray-50 dark:bg-gray-700/30' 
                            : ''
                        }`}
                      >
                        {pendingType && (
                          <div
                            className={`w-full h-full rounded flex items-center justify-center border-2 ${
                              pendingType === 'TIME_OFF' 
                                ? 'bg-orange-300 border-orange-500' 
                                : 'bg-cyan-300 border-cyan-500'
                            }`}
                            title={`${pendingRequest.userName} - PENDING ${pendingType === 'TIME_OFF' ? 'Time Off' : 'WFH'}`}
                          >
                            {zoomLevel !== 'small' && (
                              <span className="text-[8px] font-bold text-gray-800">
                                {pendingType === 'TIME_OFF' ? '🏖️' : '🏠'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* User rows */}
            {activeUsers.map(user => {
              // Get first name for display on bars
              const firstName = user.userName.split(' ')[0]
              
              return (
                <div key={user.userId} className="flex border-b border-gray-100 dark:border-gray-700/50">
                  {/* User name with profile picture - STICKY */}
                  <div
                    className={`${stickyNameCol} sticky left-0 z-10 flex items-center border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${
                      compact ? 'gap-1' : 'gap-2'
                    }`}
                  >
                    {user.profilePicture ? (
                      <img 
                        src={user.profilePicture} 
                        alt={user.userName}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-purple-300"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {user.userName[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {user.userName}
                    </span>
                  </div>
                  
                  {/* Day cells with bars and names */}
                  <div className="flex flex-1">
                    {daysInMonth.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const dayEntry = userDateMap[user.userId]?.[dateStr]
                      const isWeekendDay = isWeekend(day)
                      const isTodayDay = isToday(day)
                      const isPendingDay = pendingDates.has(dateStr)
                      const request = dayEntry ? findRequestForDate(user.userId, dateStr) : null
                      
                      // Determine styling based on type and status
                      const getBarStyle = () => {
                        if (!dayEntry) return ''
                        const isPending = dayEntry.status === 'PENDING'
                        if (dayEntry.type === 'TIME_OFF') {
                          return isPending 
                            ? 'bg-orange-400 border-2 border-dashed border-orange-600' 
                            : 'bg-red-500'
                        } else {
                          return isPending 
                            ? 'bg-cyan-400 border-2 border-dashed border-cyan-600' 
                            : 'bg-blue-500'
                        }
                      }
                      
                      return (
                        <div
                          key={dateStr}
                          style={useFitMode ? { height: '32px' } : { width: `${cellWidth * 4}px`, height: `${cellWidth * 3}px` }}
                          className={`${useFitMode ? 'flex-1 min-w-0' : 'flex-shrink-0'} flex items-center justify-center p-0.5 border-r border-gray-300 dark:border-gray-600 ${
                            isPendingDay
                              ? 'bg-yellow-100 dark:bg-yellow-900/30'
                              : isTodayDay 
                              ? 'bg-purple-50 dark:bg-purple-900/20' 
                              : isWeekendDay 
                              ? 'bg-gray-50 dark:bg-gray-700/30' 
                              : ''
                          } ${canEdit && !dayEntry ? 'hover:bg-gray-200 dark:hover:bg-gray-600' : ''}`}
                          onDragOver={canEdit ? (e) => e.preventDefault() : undefined}
                          onDrop={canEdit ? () => handleDrop(dateStr, user.userId) : undefined}
                        >
                          {dayEntry && (
                            <div
                              className={`w-full h-full rounded flex items-center justify-center ${getBarStyle()} ${(canEdit || (allowPendingApproval && dayEntry.status === 'PENDING')) ? 'cursor-pointer hover:ring-2 hover:ring-white hover:ring-opacity-50' : ''}`}
                              title={`${user.userName} - ${dayEntry.type === 'TIME_OFF' ? 'Time Off' : 'WFH'} (${dayEntry.status})${canEdit ? ' - Drag or click to edit' : allowPendingApproval && dayEntry.status === 'PENDING' ? ' - Click to approve' : ''}`}
                              onClick={(canEdit || (allowPendingApproval && dayEntry.status === 'PENDING')) ? () => handleRequestClick(user.userId, dateStr, user.userName) : undefined}
                              draggable={canEdit}
                              onDragStart={canEdit && request ? () => handleDragStart(user.userId, request.id, dayEntry.type) : undefined}
                              onDragEnd={() => setDraggedRequest(null)}
                            >
                              {zoomLevel !== 'small' && (
                                <span className={`text-[9px] font-medium truncate px-0.5 ${dayEntry.status === 'PENDING' ? 'text-gray-800' : 'text-white'}`}>
                                  {firstName}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Day Detail */}
      {selectedDay && selectedDayData && selectedDayData.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <h4 className="font-semibold text-sm mb-2 text-gray-800 dark:text-white">
            {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </h4>
          
          <div className="flex flex-wrap gap-3">
            {/* Time Off - Approved */}
            {selectedDayData.filter(e => e.type === 'TIME_OFF' && e.status === 'APPROVED').length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-600 dark:text-red-400">Time Off:</span>
                {selectedDayData.filter(e => e.type === 'TIME_OFF' && e.status === 'APPROVED').map(({ user }) => (
                  <span key={user.userId} className="text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 px-2 py-1 rounded-full">
                    {user.userName}
                  </span>
                ))}
              </div>
            )}
            
            {/* Time Off - Pending */}
            {selectedDayData.filter(e => e.type === 'TIME_OFF' && e.status === 'PENDING').length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Time Off (Pending):</span>
                {selectedDayData.filter(e => e.type === 'TIME_OFF' && e.status === 'PENDING').map(({ user }) => (
                  <span key={user.userId} className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 px-2 py-1 rounded-full border border-dashed border-orange-400">
                    {user.userName}
                  </span>
                ))}
              </div>
            )}
            
            {/* WFH - Approved */}
            {selectedDayData.filter(e => e.type === 'WFH' && e.status === 'APPROVED').length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">WFH:</span>
                {selectedDayData.filter(e => e.type === 'WFH' && e.status === 'APPROVED').map(({ user }) => (
                  <span key={user.userId} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                    {user.userName}
                  </span>
                ))}
              </div>
            )}
            
            {/* WFH - Pending */}
            {selectedDayData.filter(e => e.type === 'WFH' && e.status === 'PENDING').length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">WFH (Pending):</span>
                {selectedDayData.filter(e => e.type === 'WFH' && e.status === 'PENDING').map(({ user }) => (
                  <span key={user.userId} className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 px-2 py-1 rounded-full border border-dashed border-cyan-400">
                    {user.userName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Approval Modal */}
      {editingRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-4">
              {canEdit ? '✏️ Edit Request' : '⏳ Pending Request'} - {editingRequest.userName}
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="TIME_OFF">🏖️ Time Off</option>
                    <option value="WFH">🏠 WFH</option>
                    <option value="BOTH">📅 Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    disabled={!canEdit}
                    className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="APPROVED">✅ Approved</option>
                    <option value="PENDING">⏳ Pending</option>
                    <option value="REJECTED">❌ Rejected</option>
                  </select>
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="mt-4 p-2 bg-green-100 dark:bg-green-900/30 rounded text-xs text-green-700 dark:text-green-300">
                🔒 Changes are applied when you click Save, then you can lock calendar again.
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setEditingRequest(null)}
                disabled={isSaving || isApproving}
                className="flex-1 px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white text-sm"
              >
                Cancel
              </button>
              {allowPendingApproval && editingRequest.status === 'PENDING' && (
                <button
                  onClick={handleApprovePending}
                  disabled={isSaving || isApproving}
                  className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
                >
                  {isApproving ? 'Approving...' : '✅ Approve'}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || isApproving}
                  className="flex-1 px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white text-sm font-medium"
                >
                  {isSaving ? 'Saving...' : '💾 Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editable mode indicator */}
      {canEdit && (
        <div className="p-2 border-t border-green-500/30 bg-green-900/20">
          <p className="text-xs text-green-400 text-center">
            ✏️ Edit Mode: Click on any bar to edit, or drag to move dates
          </p>
        </div>
      )}
    </div>
  )
}

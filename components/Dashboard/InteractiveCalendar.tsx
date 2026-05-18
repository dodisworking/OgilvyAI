'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns'

interface DayData {
  date: Date
  type: 'TIME_OFF' | 'WFH' | null
}

interface NotifyUser {
  id: string
  name: string
  email: string
  profilePicture?: string | null
}

export interface NotifyEntry {
  email: string
  name?: string
}

interface InteractiveCalendarProps {
  initialBrush?: 'TIME_OFF' | 'WFH'
  userName?: string
  userEmail?: string
  initialSelectedDays?: Map<string, 'TIME_OFF' | 'WFH'> // Pre-populate with existing dates
  initialTitle?: string
  initialReason?: string
  initialNotifyEmails?: NotifyEntry[]
  onDatesSelected: (dates: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' | 'BOTH'; title?: string; reason?: string; dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'>; notifyEmails?: NotifyEntry[] }[]) => void
  onCancel: () => void
}

type BrushMode = 'TIME_OFF' | 'WFH' | null

export default function InteractiveCalendar({ initialBrush, userName = '', userEmail = '', initialSelectedDays, initialTitle, initialReason, initialNotifyEmails, onDatesSelected, onCancel }: InteractiveCalendarProps) {
  // Set initial month to first selected date if editing, otherwise current month
  const getInitialMonth = () => {
    if (initialSelectedDays && initialSelectedDays.size > 0) {
      const firstDateStr = Array.from(initialSelectedDays.keys()).sort()[0]
      return new Date(firstDateStr)
    }
    return new Date()
  }
  
  const [currentMonth, setCurrentMonth] = useState(getInitialMonth())
  const [brushMode, setBrushMode] = useState<BrushMode>(initialBrush || null)
  const [selectedDays, setSelectedDays] = useState<Map<string, 'TIME_OFF' | 'WFH'>>(initialSelectedDays || new Map())
  const [isDragging, setIsDragging] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [title, setTitle] = useState(initialTitle || '')
  const [reason, setReason] = useState(initialReason || '')
  // Per-cluster labels when the user's selection has been split into multiple
  // separate time-off batches (Map keyed by cluster start date YYYY-MM-DD).
  const [clusterLabels, setClusterLabels] = useState<Map<string, string>>(new Map())

  // Who-to-notify state
  const [allUsers, setAllUsers] = useState<NotifyUser[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [notifyEntries, setNotifyEntries] = useState<NotifyEntry[]>(initialNotifyEmails || [])
  const [customEmailInput, setCustomEmailInput] = useState('')
  const [customEmailError, setCustomEmailError] = useState('')
  const [recentRecipients, setRecentRecipients] = useState<NotifyEntry[]>([])

  useEffect(() => {
    if (!showReview) return
    if (allUsers.length > 0) return
    let cancelled = false
    setIsLoadingUsers(true)

    // Fetch teammates + recently-used recipients in parallel.
    Promise.all([
      fetch('/api/drowning/users', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { users: [] })),
      fetch('/api/notify-recipients/recent', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { recipients: [] })),
    ])
      .then(([usersData, recentData]) => {
        if (cancelled) return
        const users: NotifyUser[] = usersData.users || []
        const filteredUsers = userEmail
          ? users.filter((u) => u.email.toLowerCase() !== userEmail.toLowerCase())
          : users
        setAllUsers(filteredUsers)

        const recents: NotifyEntry[] = Array.isArray(recentData.recipients) ? recentData.recipients : []
        // Drop recents that are the requester themselves.
        const requesterEmail = (userEmail || '').toLowerCase()
        setRecentRecipients(
          recents.filter((r) => r.email.toLowerCase() !== requesterEmail).slice(0, 12)
        )
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false)
      })
    return () => {
      cancelled = true
    }
  }, [showReview, allUsers.length, userEmail])

  const isEmailNotified = (email: string) =>
    notifyEntries.some((n) => n.email.toLowerCase() === email.toLowerCase())

  const toggleUserNotify = (user: NotifyUser) => {
    if (isEmailNotified(user.email)) {
      setNotifyEntries((prev) => prev.filter((n) => n.email.toLowerCase() !== user.email.toLowerCase()))
    } else {
      setNotifyEntries((prev) => [...prev, { name: user.name, email: user.email }])
    }
  }

  const removeNotify = (email: string) => {
    setNotifyEntries((prev) => prev.filter((n) => n.email.toLowerCase() !== email.toLowerCase()))
  }

  const addCustomEmail = () => {
    const trimmed = customEmailInput.trim()
    if (!trimmed) return
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    if (!valid) {
      setCustomEmailError('Please enter a valid email address')
      return
    }
    if (isEmailNotified(trimmed)) {
      setCustomEmailError('Already added')
      return
    }
    setNotifyEntries((prev) => [...prev, { email: trimmed }])
    setCustomEmailInput('')
    setCustomEmailError('')
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return allUsers
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }, [allUsers, userSearch])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const [mouseDownDay, setMouseDownDay] = useState<Date | null>(null)
  const [hasMouseMoved, setHasMouseMoved] = useState(false)

  const toggleDay = (day: Date) => {
    if (!brushMode) return
    
    const dayKey = format(day, 'yyyy-MM-dd')
    const newSelected = new Map(selectedDays)
    
    // If clicking a day that already has the same brush type, unselect it
    if (newSelected.get(dayKey) === brushMode) {
      newSelected.delete(dayKey)
    } else {
      // Otherwise, apply the current brush mode
      newSelected.set(dayKey, brushMode)
    }
    
    setSelectedDays(newSelected)
  }

  const handleDayClick = (day: Date, event?: React.MouseEvent) => {
    if (!brushMode) return

    // Right-click or Ctrl/Cmd-click to unselect
    if (event?.button === 2 || event?.ctrlKey || event?.metaKey) {
      event?.preventDefault()
      const dayKey = format(day, 'yyyy-MM-dd')
      const newSelected = new Map(selectedDays)
      newSelected.delete(dayKey)
      setSelectedDays(newSelected)
      return
    }

    // If we dragged (mouse moved to different day), don't toggle on click
    if (hasMouseMoved) {
      setHasMouseMoved(false)
      setMouseDownDay(null)
      return
    }

    // Simple click - toggle the day
    toggleDay(day)
    setMouseDownDay(null)
    setHasMouseMoved(false)
  }

  const handleDayMouseEnter = (day: Date) => {
    if (isDragging && brushMode && mouseDownDay) {
      // If mouse entered a different day, it was a drag
      if (mouseDownDay.getTime() !== day.getTime()) {
        setHasMouseMoved(true)
      }
      
      const dayKey = format(day, 'yyyy-MM-dd')
      const newSelected = new Map(selectedDays)
      // During drag, always apply the brush (don't toggle)
      newSelected.set(dayKey, brushMode)
      setSelectedDays(newSelected)
    }
  }

  const handleMouseDown = (day: Date, event: React.MouseEvent) => {
    if (!brushMode) return
    
    // Only handle left mouse button
    if (event.button === 0) {
      setMouseDownDay(day)
      setIsDragging(true)
      setHasMouseMoved(false)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    // Don't reset hasMouseMoved here - let onClick check it
  }

  const parseDateLocal = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    // Use noon local time to avoid any timezone/DST shifting
    return new Date(year, month - 1, day, 12, 0, 0, 0)
  }

  // Explicit local date formatter to avoid any timezone issues
  const formatDateLocal = (date: Date, includeYear = true) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December']
    const monthName = months[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()
    return includeYear ? `${monthName} ${day}, ${year}` : `${monthName} ${day}`
  }

  const groupedDates = useMemo(() => {
    const sortedDates = Array.from(selectedDays.entries())
      .map(([dateStr, type]) => ({ date: parseDateLocal(dateStr), type }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const ranges: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' }[] = []
    let currentRange: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' } | null = null

    sortedDates.forEach(({ date, type }) => {
      if (!currentRange) {
        currentRange = { startDate: date, endDate: date, requestType: type }
      } else if (
        currentRange.requestType === type &&
        (date.getTime() - currentRange.endDate.getTime()) / (1000 * 60 * 60 * 24) === 1
      ) {
        // Consecutive day, extend range
        currentRange.endDate = date
      } else {
        // New range
        ranges.push(currentRange)
        currentRange = { startDate: date, endDate: date, requestType: type }
      }
    })

    if (currentRange) {
      ranges.push(currentRange)
    }

    return ranges
  }, [selectedDays])

  // Weekend-aware "batch" detection. Two selected days are in the SAME batch
  // if there are no unselected weekdays (Mon–Fri) strictly between them.
  // Friday + Monday → same batch (Sat/Sun don't count). Monday + Wednesday
  // → different batches (Tue is a workday between them).
  const clusters = useMemo(() => {
    const sortedKeys = Array.from(selectedDays.keys()).sort()
    if (sortedKeys.length === 0) return []

    const isWorkday = (d: Date) => {
      const day = d.getDay()
      return day !== 0 && day !== 6 // 0=Sun, 6=Sat
    }
    const workdaysBetween = (a: Date, b: Date) => {
      // Strictly between — exclusive of both endpoints.
      let count = 0
      const cur = new Date(a)
      cur.setDate(cur.getDate() + 1)
      while (cur.getTime() < b.getTime()) {
        if (isWorkday(cur)) count++
        cur.setDate(cur.getDate() + 1)
      }
      return count
    }

    type Cluster = {
      key: string
      dateKeys: string[]
      startDate: Date
      endDate: Date
      timeOffCount: number
      wfhCount: number
    }
    const out: Cluster[] = []
    let current: Cluster | null = null

    for (const k of sortedKeys) {
      const date = parseDateLocal(k)
      const type = selectedDays.get(k)
      if (!current) {
        current = {
          key: k,
          dateKeys: [k],
          startDate: date,
          endDate: date,
          timeOffCount: type === 'TIME_OFF' ? 1 : 0,
          wfhCount: type === 'WFH' ? 1 : 0,
        }
        continue
      }
      const gap = workdaysBetween(current.endDate, date)
      if (gap === 0) {
        current.endDate = date
        current.dateKeys.push(k)
        if (type === 'TIME_OFF') current.timeOffCount++
        else if (type === 'WFH') current.wfhCount++
      } else {
        out.push(current)
        current = {
          key: k,
          dateKeys: [k],
          startDate: date,
          endDate: date,
          timeOffCount: type === 'TIME_OFF' ? 1 : 0,
          wfhCount: type === 'WFH' ? 1 : 0,
        }
      }
    }
    if (current) out.push(current)
    return out
  }, [selectedDays])

  const handleSubmit = () => {
    if (groupedDates.length === 0) {
      alert('Please select at least one day')
      return
    }
    
    // Suggest default title based on request type
    const hasTimeOff = groupedDates.some(d => d.requestType === 'TIME_OFF')
    const hasWFH = groupedDates.some(d => d.requestType === 'WFH')
    
    if (!title) {
      if (hasTimeOff && hasWFH) {
        setTitle(`${userName} Time Off & Work From Home`)
      } else if (hasTimeOff && !hasWFH) {
        setTitle(`${userName} Vacation Time`)
      } else if (hasWFH && !hasTimeOff) {
        setTitle(`${userName} Work From Home`)
      } else {
        setTitle(`${userName} Time Off`)
      }
    }
    
    setShowReview(true)
  }

  const handleConfirmSubmit = () => {
    // Check if we have both Time Off and WFH days selected
    const hasTimeOff = groupedDates.some(d => d.requestType === 'TIME_OFF')
    const hasWFH = groupedDates.some(d => d.requestType === 'WFH')
    
    // Build dayBreakdown directly from selectedDays Map (this ensures all individual days are included)
    const dayBreakdown: Record<string, 'TIME_OFF' | 'WFH'> = {}
    selectedDays.forEach((type, dateKey) => {
      dayBreakdown[dateKey] = type
    })
    
    const allSelectedDates = Array.from(selectedDays.keys())
      .map(dateStr => parseDateLocal(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())

    const earliestStart = allSelectedDates[0]
    const latestEnd = allSelectedDates[allSelectedDates.length - 1]

    const requestType: 'TIME_OFF' | 'WFH' | 'BOTH' =
      hasTimeOff && hasWFH ? 'BOTH' : hasTimeOff ? 'TIME_OFF' : 'WFH'

    // If the selection forms multiple separate batches (weekend-aware), submit
    // one request per batch so Tim can approve/reject each individually.
    // Otherwise fall back to a single combined request like before.
    let finalDates: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' | 'BOTH'; title?: string; reason?: string; dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'>; notifyEmails?: NotifyEntry[] }[]

    if (clusters.length > 1) {
      finalDates = clusters.map((cluster) => {
        const clusterBreakdown: Record<string, 'TIME_OFF' | 'WFH'> = {}
        for (const k of cluster.dateKeys) {
          const t = selectedDays.get(k)
          if (t) clusterBreakdown[k] = t
        }
        const clusterType: 'TIME_OFF' | 'WFH' | 'BOTH' =
          cluster.timeOffCount > 0 && cluster.wfhCount > 0
            ? 'BOTH'
            : cluster.wfhCount > 0
              ? 'WFH'
              : 'TIME_OFF'
        const customLabel = clusterLabels.get(cluster.key)?.trim()
        return {
          startDate: cluster.startDate,
          endDate: cluster.endDate,
          requestType: clusterType,
          title: customLabel || title || undefined,
          reason: reason || undefined,
          dayBreakdown: clusterBreakdown,
          notifyEmails: notifyEntries.length > 0 ? notifyEntries : undefined,
        }
      })
    } else {
      finalDates = [
        {
          startDate: earliestStart,
          endDate: latestEnd,
          requestType,
          title: title || undefined,
          reason: reason || undefined,
          dayBreakdown,
          notifyEmails: notifyEntries.length > 0 ? notifyEntries : undefined,
        },
      ]
    }

    // Close review modal first
    setShowReview(false)

    // Call the callback with the dates
    onDatesSelected(finalDates)

    // Reset form
    setTitle('')
    setReason('')
    setSelectedDays(new Map())
    setNotifyEntries([])
    setCustomEmailInput('')
    setCustomEmailError('')
    setClusterLabels(new Map())
  }

  const titleSuggestions = [
    `${userName} Vacation Time`,
    `${userName} Family Time`,
    `${userName} Personal Time`,
    `${userName} Sick Leave`,
    `${userName} Holiday`,
  ]

  const clearSelection = () => {
    setSelectedDays(new Map())
  }

  const getDayType = (day: Date): 'TIME_OFF' | 'WFH' | null => {
    const dayKey = format(day, 'yyyy-MM-dd')
    return selectedDays.get(dayKey) || null
  }

  if (showReview) {
    // Calculate summary stats
    const timeOffDays = Array.from(selectedDays.values()).filter(v => v === 'TIME_OFF').length
    const wfhDays = Array.from(selectedDays.values()).filter(v => v === 'WFH').length
    const hasTimeOff = timeOffDays > 0
    const hasWFH = wfhDays > 0
    const isCombined = hasTimeOff && hasWFH
    
    // Get sorted dates for display
    const sortedDayEntries = Array.from(selectedDays.entries())
      .map(([dateStr, type]) => ({ date: parseDateLocal(dateStr), type, dateStr }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
    
    const firstDate = sortedDayEntries[0]?.date
    const lastDate = sortedDayEntries[sortedDayEntries.length - 1]?.date

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 relative my-8">
          <h2 className="text-2xl font-bold mb-6">
            Review Your Submission
          </h2>

          {/* Single Unified Submission Card */}
          <div className={`p-5 rounded-xl border-2 mb-6 ${
            isCombined 
              ? 'bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-400 dark:border-purple-600'
              : hasTimeOff
              ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
          }`}>
            {/* Header - ONE Submission */}
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                isCombined 
                  ? 'bg-gradient-to-r from-red-400 to-blue-400'
                  : hasTimeOff
                  ? 'bg-red-400'
                  : 'bg-blue-400'
              }`}>
                {isCombined ? '📦' : hasTimeOff ? '🏖️' : '🏠'}
              </div>
              <div>
                <p className="font-bold text-lg">
                  {isCombined 
                    ? 'Combined Request' 
                    : hasTimeOff 
                    ? 'Time Off Request' 
                    : 'Work From Home Request'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedDays.size} day{selectedDays.size !== 1 ? 's' : ''} total
                  {isCombined && ` • ${timeOffDays} Time Off, ${wfhDays} WFH`}
                </p>
              </div>
            </div>

            {/* Date Range Summary */}
            <div className="mb-4 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📅 {firstDate && lastDate && (
                  isSameDay(firstDate, lastDate)
                    ? formatDateLocal(firstDate, true)
                    : `${formatDateLocal(firstDate, false)} - ${formatDateLocal(lastDate, true)}`
                )}
              </p>
            </div>

            {/* Day-by-Day Breakdown */}
            <div className="max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Day Breakdown:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sortedDayEntries.map(({ date, type }, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      type === 'TIME_OFF'
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200'
                        : 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
                    }`}
                  >
                    <span>{type === 'TIME_OFF' ? '🏖️' : '🏠'}</span>
                    <span>{formatDateLocal(date, false)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {clusters.length > 1 ? (
            /* Multi-batch mode: one label per detected batch */
            <div className="mb-4 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-700 bg-orange-50/40 dark:bg-orange-900/10">
              <div className="flex items-start gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white text-sm flex-shrink-0">
                  📦
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    We grouped your selection into {clusters.length} separate batches
                  </p>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    Each batch gets its own request so Tim can approve or reject them one by one.
                    Weekends in between don&apos;t count as a break.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {clusters.map((cluster, idx) => {
                  const sameDay = cluster.startDate.toDateString() === cluster.endDate.toDateString()
                  const rangeLabel = sameDay
                    ? formatDateLocal(cluster.startDate, true)
                    : `${formatDateLocal(cluster.startDate, false)} – ${formatDateLocal(cluster.endDate, true)}`
                  return (
                    <div
                      key={cluster.key}
                      className="p-2.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                          {rangeLabel}
                        </p>
                        <span className="text-[10px] text-gray-500 ml-auto">
                          {cluster.timeOffCount > 0 && `${cluster.timeOffCount} time off`}
                          {cluster.timeOffCount > 0 && cluster.wfhCount > 0 && ' · '}
                          {cluster.wfhCount > 0 && `${cluster.wfhCount} WFH`}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={clusterLabels.get(cluster.key) || ''}
                        onChange={(e) => {
                          const next = new Map(clusterLabels)
                          next.set(cluster.key, e.target.value)
                          setClusterLabels(next)
                        }}
                        placeholder={`Label for batch ${idx + 1} (e.g., ${idx === 0 ? 'Long weekend' : idx === 1 ? 'Family visit' : 'Vacation'})`}
                        className="w-full px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Single-batch mode: original Title field */
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Vacation Time, Family Time"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {titleSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTitle(suggestion)}
                    className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reason Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you taking these days off?"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Who to Notify */}
          <div className="mb-6 p-5 rounded-xl border-2 border-purple-200 dark:border-purple-700 bg-gradient-to-br from-purple-50/60 to-pink-50/60 dark:from-purple-900/10 dark:to-pink-900/10">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg flex-shrink-0">
                📩
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-gray-100">
                  Who do you want to let know?
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Once Tim approves, we&apos;ll send each person a calendar invite for these days.
                  It will appear as <strong>Free</strong> on their Outlook calendar.
                </p>
              </div>
            </div>

            {/* Selected chips */}
            {notifyEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 p-2 bg-white/60 dark:bg-gray-900/30 rounded-lg">
                {notifyEntries.map((entry) => (
                  <span
                    key={entry.email}
                    className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-purple-600 text-white text-xs font-medium"
                  >
                    {entry.name || entry.email}
                    <button
                      type="button"
                      onClick={() => removeNotify(entry.email)}
                      aria-label={`Remove ${entry.email}`}
                      className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Recently invited — one-tap add for the people you usually loop in */}
            {recentRecipients.filter((r) => !isEmailNotified(r.email)).length > 0 && (
              <div className="mb-3 p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                    🕘 Recently invited
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const toAdd = recentRecipients.filter((r) => !isEmailNotified(r.email))
                      setNotifyEntries((prev) => [...prev, ...toAdd])
                    }}
                    className="text-[11px] font-medium text-purple-700 hover:text-purple-900 dark:text-purple-300"
                  >
                    Add everyone
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentRecipients
                    .filter((r) => !isEmailNotified(r.email))
                    .map((r) => (
                      <button
                        key={r.email}
                        type="button"
                        onClick={() => setNotifyEntries((prev) => [...prev, r])}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                      >
                        <span>+</span>
                        <span>{r.name || r.email}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Search + user list */}
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search team by name or email…"
              className="w-full px-3 py-2 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              {isLoadingUsers ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm py-4">
                  {userSearch ? 'No matches' : 'No teammates available'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredUsers.map((u) => {
                    const checked = isEmailNotified(u.email)
                    return (
                      <li key={u.id}>
                        <label
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                            checked
                              ? 'bg-purple-50 dark:bg-purple-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUserNotify(u)}
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
                            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                              {u.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                              {u.name}
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

            {/* Custom email entry */}
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Or add an email manually:
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={customEmailInput}
                  onChange={(e) => {
                    setCustomEmailInput(e.target.value)
                    if (customEmailError) setCustomEmailError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomEmail()
                    }
                  }}
                  placeholder="someone@company.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addCustomEmail}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
              {customEmailError && (
                <p className="text-xs text-red-600 mt-1">{customEmailError}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setShowReview(false)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Back
            </button>
            <button
              onClick={handleConfirmSubmit}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all font-medium"
            >
              Submit Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <div className="relative">

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">
            Select Your Days
          </h2>
          
          {/* Selected Days Summary - Fixed at top right */}
          <div className={`min-w-[180px] transition-all duration-200 ${selectedDays.size > 0 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-right">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {selectedDays.size} day{selectedDays.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-1.5 justify-end">
                <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-semibold">
                  Time Off: {Array.from(selectedDays.values()).filter(v => v === 'TIME_OFF').length}
                </span>
                <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-semibold">
                  WFH: {Array.from(selectedDays.values()).filter(v => v === 'WFH').length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Brush Mode Selector */}
        <div className="mb-3 p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs font-medium mb-2">Choose brush mode:</p>
          <div className="flex gap-2">
            <button
              onClick={() => setBrushMode('TIME_OFF')}
              className={`flex-1 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                brushMode === 'TIME_OFF'
                  ? 'border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'border-gray-300 dark:border-gray-600 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-300'
              }`}
            >
              Time Off
            </button>
            <button
              onClick={() => setBrushMode('WFH')}
              className={`flex-1 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                brushMode === 'WFH'
                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300'
              }`}
            >
              Work From Home
            </button>
          </div>
          {brushMode && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5">
              Click or drag to select days. Click again to unselect.
            </p>
          )}
        </div>

        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs"
          >
            ← Prev
          </button>
          <h3 className="text-base font-bold">{format(currentMonth, 'MMMM yyyy')}</h3>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="mb-3">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-0.5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month starts */}
            {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square"></div>
            ))}

            {/* Actual days */}
            {daysInMonth.map((day) => {
              const dayType = getDayType(day)
              const today = isToday(day)

              return (
                <button
                  key={day.toString()}
                  onClick={(e) => handleDayClick(day, e)}
                  onMouseDown={(e) => handleMouseDown(day, e)}
                  onMouseEnter={() => handleDayMouseEnter(day)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (brushMode) {
                      const dayKey = format(day, 'yyyy-MM-dd')
                      const newSelected = new Map(selectedDays)
                      newSelected.delete(dayKey)
                      setSelectedDays(newSelected)
                    }
                  }}
                  disabled={!brushMode}
                  className={`aspect-square rounded border transition-all text-xs font-medium ${
                    dayType === 'TIME_OFF'
                      ? 'bg-red-200 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-300 dark:hover:bg-red-900/60'
                      : dayType === 'WFH'
                      ? 'bg-blue-200 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-300 dark:hover:bg-blue-900/60'
                      : today
                      ? 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${!brushMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>


        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-xs"
          >
            Cancel
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium text-xs"
          >
            Clear
          </button>
          <button
            onClick={handleSubmit}
            disabled={selectedDays.size === 0}
            className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Review & Submit ({selectedDays.size})
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns'

interface DayData {
  date: Date
  type: 'TIME_OFF' | 'WFH' | null
}

interface InteractiveCalendarProps {
  initialBrush?: 'TIME_OFF' | 'WFH'
  userName?: string
  initialSelectedDays?: Map<string, 'TIME_OFF' | 'WFH'> // Pre-populate with existing dates
  initialTitle?: string
  initialReason?: string
  onDatesSelected: (dates: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' | 'BOTH'; title?: string; reason?: string; dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'> }[]) => void
  onCancel: () => void
}

type BrushMode = 'TIME_OFF' | 'WFH' | null

export default function InteractiveCalendar({ initialBrush, userName = '', initialSelectedDays, initialTitle, initialReason, onDatesSelected, onCancel }: InteractiveCalendarProps) {
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

  const groupedDates = useMemo(() => {
    const sortedDates = Array.from(selectedDays.entries())
      .map(([dateStr, type]) => ({ date: new Date(dateStr), type }))
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
    
    let finalDates: { startDate: Date; endDate: Date; requestType: 'TIME_OFF' | 'WFH' | 'BOTH'; title?: string; reason?: string; dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'> }[]
    
    if (hasTimeOff && hasWFH) {
      // If both types are selected, combine them into one request with type BOTH
      // Find the earliest start date and latest end date from all selected days
      const allSelectedDates = Array.from(selectedDays.keys())
        .map(dateStr => new Date(dateStr))
        .sort((a, b) => a.getTime() - b.getTime())
      
      const earliestStart = allSelectedDates[0]
      const latestEnd = allSelectedDates[allSelectedDates.length - 1]
      
      // Create one combined request with type BOTH and day breakdown
      finalDates = [{
        startDate: earliestStart,
        endDate: latestEnd,
        requestType: 'BOTH',
        title: title || undefined,
        reason: reason || undefined,
        dayBreakdown,
      }]
    } else {
      // If only one type, submit as normal (still include breakdown for consistency)
      finalDates = groupedDates.map(range => ({
        ...range,
        title: title || undefined,
        reason: reason || undefined,
        dayBreakdown,
      }))
    }

    // Close review modal first
    setShowReview(false)
    
    // Call the callback with the dates
    onDatesSelected(finalDates)
    
    // Reset form
    setTitle('')
    setReason('')
    setSelectedDays(new Map())
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
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 relative my-8">
          <h2 className="text-2xl font-bold mb-6">
            Review Your Selection
          </h2>

          {/* Combined Package Notice */}
          {groupedDates.some(d => d.requestType === 'TIME_OFF') && groupedDates.some(d => d.requestType === 'WFH') && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-lg">
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                📦 Combined Package
              </p>
              <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                Your Time Off and Work From Home days will be submitted together as one combined request.
              </p>
            </div>
          )}

          {/* Date Ranges */}
          <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
            {groupedDates.map((range, idx) => {
              const requestType = range.requestType as 'TIME_OFF' | 'WFH' | 'BOTH'
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    requestType === 'TIME_OFF'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                      : requestType === 'WFH'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                      : 'bg-gradient-to-r from-red-50 to-blue-50 dark:from-red-900/20 dark:to-blue-900/20 border-purple-300 dark:border-purple-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {requestType === 'TIME_OFF' 
                          ? 'Time Off' 
                          : requestType === 'WFH'
                          ? 'Work From Home'
                          : 'Time Off & Work From Home'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {isSameDay(range.startDate, range.endDate)
                          ? format(range.startDate, 'MMMM d, yyyy')
                          : `${format(range.startDate, 'MMMM d')} - ${format(range.endDate, 'MMMM d, yyyy')}`}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Title Field */}
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
            {/* Title Suggestions */}
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

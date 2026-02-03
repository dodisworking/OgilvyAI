'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns'

type DrowningRecipientUser = { id: string; name: string; email: string }

interface DrowningCalendarProps {
  userName?: string
  initialSelectedDays?: Set<string>
  initialNatureOfNeed?: string
  onDatesSelected: (dates: { startDate: Date; endDate: Date; natureOfNeed?: string; dayBreakdown?: Record<string, boolean>; sendToAll?: boolean; selectedUserIds?: string[] }) => void
  onCancel: () => void
}

export default function DrowningCalendar({ userName = '', initialSelectedDays, initialNatureOfNeed, onDatesSelected, onCancel }: DrowningCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDays, setSelectedDays] = useState<Set<string>>(initialSelectedDays || new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [natureOfNeed, setNatureOfNeed] = useState(initialNatureOfNeed || '')
  const [sendToAll, setSendToAll] = useState(true)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [users, setUsers] = useState<DrowningRecipientUser[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [mouseDownDay, setMouseDownDay] = useState<Date | null>(null)
  const [hasMouseMoved, setHasMouseMoved] = useState(false)

  useEffect(() => {
    setSelectedDays(initialSelectedDays || new Set())
    setNatureOfNeed(initialNatureOfNeed || '')
  }, [initialSelectedDays, initialNatureOfNeed])

  useEffect(() => {
    if (showReview && !sendToAll && users.length === 0 && !usersLoading) {
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only fetch when switching to "select" or opening review
  }, [showReview, sendToAll])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  const toggleDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd')
    const newSelected = new Set(selectedDays)
    
    if (newSelected.has(dayKey)) {
      newSelected.delete(dayKey)
    } else {
      newSelected.add(dayKey)
    }
    
    setSelectedDays(newSelected)
  }

  const handleDayClick = (day: Date) => {
    if (hasMouseMoved) {
      setHasMouseMoved(false)
      setMouseDownDay(null)
      return
    }
    toggleDay(day)
    setMouseDownDay(null)
  }

  const handleDayMouseEnter = (day: Date) => {
    if (isDragging && mouseDownDay) {
      setHasMouseMoved(true)
      const dayKey = format(day, 'yyyy-MM-dd')
      if (!selectedDays.has(dayKey)) {
        const newSelected = new Set(selectedDays)
        newSelected.add(dayKey)
        setSelectedDays(newSelected)
      }
    }
  }

  const handleMouseDown = (day: Date, event: React.MouseEvent) => {
    if (event.button === 0) {
      setMouseDownDay(day)
      setIsDragging(true)
      setHasMouseMoved(false)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const groupedDates = useMemo(() => {
    const sortedDates = Array.from(selectedDays)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())

    const ranges: { startDate: Date; endDate: Date }[] = []
    let currentRange: { startDate: Date; endDate: Date } | null = null

    sortedDates.forEach((date) => {
      if (!currentRange) {
        currentRange = { startDate: date, endDate: date }
      } else if (
        (date.getTime() - currentRange.endDate.getTime()) / (1000 * 60 * 60 * 24) === 1
      ) {
        currentRange.endDate = date
      } else {
        ranges.push(currentRange)
        currentRange = { startDate: date, endDate: date }
      }
    })

    if (currentRange) {
      ranges.push(currentRange)
    }

    return ranges
  }, [selectedDays])

  const handleSubmit = () => {
    if (selectedDays.size === 0) {
      alert('Please select at least one day')
      return
    }
    setShowReview(true)
  }

  const handleConfirmSubmit = () => {
    if (!sendToAll && selectedUserIds.size === 0) {
      alert('Please select at least one person to notify, or choose "Send SOS to everyone".')
      return
    }
    const allSelectedDates = Array.from(selectedDays)
      .map(dateStr => new Date(dateStr))
      .sort((a, b) => a.getTime() - b.getTime())
    
    const earliestStart = allSelectedDates[0]
    const latestEnd = allSelectedDates[allSelectedDates.length - 1]
    
    const dayBreakdown: Record<string, boolean> = {}
    selectedDays.forEach(dateKey => {
      dayBreakdown[dateKey] = true
    })

    setShowReview(false)
    onDatesSelected({
      startDate: earliestStart,
      endDate: latestEnd,
      natureOfNeed: natureOfNeed || undefined,
      dayBreakdown,
      sendToAll,
      selectedUserIds: sendToAll ? undefined : Array.from(selectedUserIds),
    })
  }

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }

  const toggleRecipient = (id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedDays(new Set())
  }

  const isSelected = (day: Date): boolean => {
    const dayKey = format(day, 'yyyy-MM-dd')
    return selectedDays.has(dayKey)
  }

  // Water animation background
  const WaterBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-blue-400/20 via-blue-300/30 to-blue-500/20 animate-pulse"></div>
      <div className="absolute top-1/4 left-0 w-full h-1/3 bg-blue-400/15 transform -skew-y-12 animate-slide"></div>
      <div className="absolute top-2/3 right-0 w-full h-1/4 bg-blue-300/20 transform skew-y-6 animate-slide-reverse"></div>
      <style jsx>{`
        @keyframes slide {
          0%, 100% { transform: translateX(0) -skew-y-12; }
          50% { transform: translateX(10px) -skew-y-12; }
        }
        @keyframes slide-reverse {
          0%, 100% { transform: translateX(0) skew-y-6; }
          50% { transform: translateX(-10px) skew-y-6; }
        }
        .animate-slide {
          animation: slide 3s ease-in-out infinite;
        }
        .animate-slide-reverse {
          animation: slide-reverse 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )

  if (showReview) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 relative my-8">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold mb-2">🆘 Review Your Help Request</h2>
            <p className="text-gray-600 dark:text-gray-400">Someone needs to throw you a lifeline!</p>
          </div>

          {/* Date Ranges */}
          <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
            {groupedDates.map((range, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg border-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-blue-300 dark:border-blue-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-200">Days You Need Help</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {isSameDay(range.startDate, range.endDate)
                        ? format(range.startDate, 'MMMM d, yyyy')
                        : `${format(range.startDate, 'MMMM d')} - ${format(range.endDate, 'MMMM d, yyyy')}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nature of Need Field */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nature of Need <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <textarea
              value={natureOfNeed}
              onChange={(e) => setNatureOfNeed(e.target.value)}
              placeholder="What kind of help do you need? (e.g., project assistance, deadline help, technical support...)"
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Who to notify: everyone or select group */}
          <div className="mb-6 space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Who should receive the SOS email?</p>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700 space-y-3">
              <label className="flex items-start cursor-pointer gap-3">
                <input
                  type="radio"
                  name="sosRecipients"
                  checked={sendToAll}
                  onChange={() => setSendToAll(true)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div>
                  <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                    📧 Send SOS to everyone
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Notify the whole department. They&apos;ll get an email asking if they&apos;re up for the task.
                  </p>
                </div>
              </label>
              <label className="flex items-start cursor-pointer gap-3">
                <input
                  type="radio"
                  name="sosRecipients"
                  checked={!sendToAll}
                  onChange={() => setSendToAll(false)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <div className="flex-1">
                  <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                    👥 Select what group of people you want to send it to
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Choose who receives the rescue mission email.
                  </p>
                </div>
              </label>
            </div>

            {!sendToAll && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
                {usersLoading ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading people...</p>
                ) : users.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No users found.</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(u.id)}
                          onChange={() => toggleRecipient(u.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">{u.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              disabled={!sendToAll && selectedUserIds.size === 0}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🆘 Send SOS
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full relative" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      <WaterBackground />
      
      <div className="relative z-10">
        <button
          onClick={onCancel}
          className="absolute top-0 right-0 text-gray-400 hover:text-gray-600 text-2xl z-10"
        >
          ×
        </button>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-blue-900 dark:text-blue-100">
            🆘 Select Days You Need Help
          </h2>
          
          {/* Selected Days Summary */}
          <div className={`min-w-[120px] transition-all duration-200 ${selectedDays.size > 0 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="text-right">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">
                {selectedDays.size} day{selectedDays.size !== 1 ? 's' : ''} selected
              </div>
            </div>
          </div>
        </div>

        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 Click or drag to select days when you need help. Click again to unselect.
          </p>
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
              const selected = isSelected(day)
              const today = isToday(day)

              return (
                <button
                  key={day.toString()}
                  onClick={(e) => handleDayClick(day)}
                  onMouseDown={(e) => handleMouseDown(day, e)}
                  onMouseEnter={() => handleDayMouseEnter(day)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    const dayKey = format(day, 'yyyy-MM-dd')
                    const newSelected = new Set(selectedDays)
                    newSelected.delete(dayKey)
                    setSelectedDays(newSelected)
                  }}
                  className={`aspect-square rounded border transition-all text-xs font-medium relative overflow-hidden ${
                    selected
                      ? 'bg-gradient-to-br from-blue-400 to-cyan-500 border-blue-600 dark:border-blue-400 text-white shadow-lg transform scale-105'
                      : today
                      ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/60'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  } cursor-pointer`}
                >
                  {format(day, 'd')}
                  {selected && (
                    <div className="absolute top-0 right-0 text-xs">🆘</div>
                  )}
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
            className="flex-1 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transition-all font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🆘 Review SOS ({selectedDays.size})
          </button>
        </div>
      </div>
    </div>
  )
}

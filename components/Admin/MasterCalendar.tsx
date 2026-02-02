'use client'

import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek, addMonths, subMonths, isSameDay, parseISO } from 'date-fns'
import { Request } from '@/types'

interface MasterCalendarProps {
  requests: Request[]
}

export default function MasterCalendar({ requests }: MasterCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Filter to only approved requests
  const approvedRequests = useMemo(() => {
    return requests.filter(r => r.status === 'APPROVED')
  }, [requests])

  // Create a map of dates to requests for quick lookup
  const dateToRequestsMap = useMemo(() => {
    const map = new Map<string, Array<{ request: Request; type: 'TIME_OFF' | 'WFH' }>>()

    approvedRequests.forEach(request => {
      const startDate = new Date(request.startDate)
      const endDate = new Date(request.endDate)
      const days = eachDayOfInterval({ start: startDate, end: endDate })

      // Parse dayBreakdown if available
      let dayBreakdown: Record<string, 'TIME_OFF' | 'WFH'> = {}
      if (request.dayBreakdown) {
        if (typeof request.dayBreakdown === 'string') {
          try {
            dayBreakdown = JSON.parse(request.dayBreakdown)
          } catch (e) {
            console.error('Failed to parse dayBreakdown:', e)
          }
        } else {
          dayBreakdown = request.dayBreakdown as Record<string, 'TIME_OFF' | 'WFH'>
        }
      }

      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd')
        const dayType = dayBreakdown[dateKey] || 
          (request.requestType === 'BOTH' ? null : request.requestType === 'TIME_OFF' ? 'TIME_OFF' : 'WFH')

        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }

        // For BOTH requests without breakdown, add both types
        if (request.requestType === 'BOTH' && !dayType) {
          map.get(dateKey)!.push(
            { request, type: 'TIME_OFF' },
            { request, type: 'WFH' }
          )
        } else if (dayType) {
          map.get(dateKey)!.push({ request, type: dayType })
        } else {
          // Fallback: use request type
          const type = request.requestType === 'TIME_OFF' ? 'TIME_OFF' : 'WFH'
          map.get(dateKey)!.push({ request, type })
        }
      })
    })

    return map
  }, [approvedRequests])

  // Get calendar days for current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getDayInfo = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    const dayRequests = dateToRequestsMap.get(dateKey) || []
    
    const timeOffRequests = dayRequests.filter(r => r.type === 'TIME_OFF')
    const wfhRequests = dayRequests.filter(r => r.type === 'WFH')
    
    return {
      timeOffRequests,
      wfhRequests,
      hasTimeOff: timeOffRequests.length > 0,
      hasWFH: wfhRequests.length > 0,
      totalRequests: dayRequests.length
    }
  }

  const getDayColor = (day: Date) => {
    const info = getDayInfo(day)
    
    if (info.hasTimeOff && info.hasWFH) {
      return 'bg-gradient-to-br from-red-200 to-blue-200 dark:from-red-900/40 dark:to-blue-900/40 border-purple-300 dark:border-purple-700'
    } else if (info.hasTimeOff) {
      return 'bg-red-200 dark:bg-red-900/40 border-red-300 dark:border-red-700'
    } else if (info.hasWFH) {
      return 'bg-blue-200 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700'
    }
    
    return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1))
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
          Master Calendar
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          View all approved time off and work from home schedules
        </p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          ← Previous
        </button>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-600 dark:text-gray-400 py-2"
          >
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((day, idx) => {
          const info = getDayInfo(day)
          const inMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())
          const dayColor = getDayColor(day)

          return (
            <div
              key={idx}
              className={`
                min-h-[100px] p-2 rounded-lg border-2 transition-all
                ${dayColor}
                ${!inMonth ? 'opacity-40' : ''}
                ${isToday ? 'ring-2 ring-purple-500 ring-offset-2' : ''}
                ${info.totalRequests > 0 ? 'cursor-pointer hover:shadow-md' : ''}
              `}
              title={info.totalRequests > 0 ? `${info.totalRequests} request(s) on this day` : undefined}
            >
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {format(day, 'd')}
              </div>
              
              {/* Show request info */}
              {info.totalRequests > 0 && (
                <div className="space-y-1 text-xs">
                  {info.timeOffRequests.length > 0 && (
                    <div className="text-red-700 dark:text-red-300 font-medium">
                      🏖️ {info.timeOffRequests.length} Time Off
                    </div>
                  )}
                  {info.wfhRequests.length > 0 && (
                    <div className="text-blue-700 dark:text-blue-300 font-medium">
                      🏠 {info.wfhRequests.length} WFH
                    </div>
                  )}
                  
                  {/* Show user names */}
                  <div className="mt-1 space-y-0.5">
                    {Array.from(new Set(info.timeOffRequests.map(r => r.request.user?.name).filter(Boolean))).map((name, i) => (
                      <div key={`to-${i}`} className="text-red-600 dark:text-red-400 truncate">
                        {name}
                      </div>
                    ))}
                    {Array.from(new Set(info.wfhRequests.map(r => r.request.user?.name).filter(Boolean))).map((name, i) => (
                      <div key={`wfh-${i}`} className="text-blue-600 dark:text-blue-400 truncate">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-900/40 border border-red-300 dark:border-red-700"></div>
          <span className="text-gray-700 dark:text-gray-300">Time Off</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-200 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"></div>
          <span className="text-gray-700 dark:text-gray-300">Work From Home</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-red-200 to-blue-200 dark:from-red-900/40 dark:to-blue-900/40 border border-purple-300 dark:border-purple-700"></div>
          <span className="text-gray-700 dark:text-gray-300">Both</span>
        </div>
      </div>
    </div>
  )
}

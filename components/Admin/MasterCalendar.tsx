'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay } from 'date-fns'

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

export default function MasterCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [userSchedules, setUserSchedules] = useState<UserSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    fetchAllSchedules()
  }, [currentMonth])

  const fetchAllSchedules = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/master-calendar')
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

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  
  // Get day of week for first day (0 = Sunday)
  const startDayOfWeek = getDay(monthStart)
  
  // Create padding for days before the month starts
  const paddingDays = Array(startDayOfWeek).fill(null)

  // Build a map of date -> users with events
  const dateEventsMap = useMemo(() => {
    const map: Record<string, { wfh: UserSchedule[], timeOff: UserSchedule[] }> = {}
    
    userSchedules.forEach(user => {
      user.requests.forEach(request => {
        if (request.status !== 'APPROVED') return
        
        const start = new Date(request.startDate)
        const end = new Date(request.endDate)
        const days = eachDayOfInterval({ start, end })
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          if (!map[dateStr]) {
            map[dateStr] = { wfh: [], timeOff: [] }
          }
          
          // Check day breakdown if available
          let dayType = request.requestType
          if (request.dayBreakdown && request.dayBreakdown[dateStr]) {
            dayType = request.dayBreakdown[dateStr] as 'WFH' | 'TIME_OFF'
          }
          
          if (dayType === 'WFH' || dayType === 'BOTH') {
            if (!map[dateStr].wfh.find(u => u.userId === user.userId)) {
              map[dateStr].wfh.push(user)
            }
          }
          if (dayType === 'TIME_OFF' || dayType === 'BOTH') {
            if (!map[dateStr].timeOff.find(u => u.userId === user.userId)) {
              map[dateStr].timeOff.push(user)
            }
          }
        })
      })
    })
    
    return map
  }, [userSchedules])

  const selectedDayData = selectedDay ? dateEventsMap[selectedDay] : null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
          Master Calendar - Team Coverage
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-center mb-4 text-gray-700 dark:text-gray-200">
        {format(currentMonth, 'MMMM yyyy')}
      </h3>

      {/* Legend */}
      <div className="flex gap-6 mb-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-400"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Time Off</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-400"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">WFH</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center py-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              {day}
            </div>
          ))}
          
          {/* Padding days */}
          {paddingDays.map((_, idx) => (
            <div key={`pad-${idx}`} className="aspect-square"></div>
          ))}
          
          {/* Calendar days */}
          {daysInMonth.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const events = dateEventsMap[dateStr]
            const hasTimeOff = events?.timeOff?.length > 0
            const hasWFH = events?.wfH?.length > 0 || events?.wfh?.length > 0
            const totalPeople = (events?.timeOff?.length || 0) + (events?.wfh?.length || 0)
            
            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDay(selectedDay === dateStr ? null : dateStr)}
                className={`
                  aspect-square p-1 rounded-lg cursor-pointer transition-all border-2
                  ${isToday(day) ? 'border-purple-500' : 'border-transparent'}
                  ${selectedDay === dateStr ? 'ring-2 ring-purple-400' : ''}
                  ${!isSameMonth(day, currentMonth) ? 'opacity-30' : ''}
                  hover:bg-gray-50 dark:hover:bg-gray-700
                `}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {format(day, 'd')}
                </div>
                <div className="flex flex-col gap-0.5">
                  {hasTimeOff && (
                    <div className="h-2 rounded bg-red-400 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">{events?.timeOff?.length}</span>
                    </div>
                  )}
                  {(events?.wfh?.length || 0) > 0 && (
                    <div className="h-2 rounded bg-blue-400 flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">{events?.wfh?.length}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Selected Day Detail */}
      {selectedDay && selectedDayData && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
          <h4 className="font-semibold text-lg mb-3 text-gray-800 dark:text-white">
            {format(new Date(selectedDay), 'EEEE, MMMM d, yyyy')}
          </h4>
          
          {selectedDayData.timeOff.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                🏖️ Time Off ({selectedDayData.timeOff.length})
              </h5>
              <div className="flex flex-wrap gap-2">
                {selectedDayData.timeOff.map(user => (
                  <div key={user.userId} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-1 rounded-full">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt={user.userName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-red-300 flex items-center justify-center text-xs font-bold text-red-800">
                        {user.userName[0]}
                      </div>
                    )}
                    <span className="text-sm text-red-800 dark:text-red-200">{user.userName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedDayData.wfh.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                🏠 Working From Home ({selectedDayData.wfh.length})
              </h5>
              <div className="flex flex-wrap gap-2">
                {selectedDayData.wfh.map(user => (
                  <div key={user.userId} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-3 py-1 rounded-full">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt={user.userName} className="w-6 h-6 rounded-full object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-300 flex items-center justify-center text-xs font-bold text-blue-800">
                        {user.userName[0]}
                      </div>
                    )}
                    <span className="text-sm text-blue-800 dark:text-blue-200">{user.userName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {selectedDayData.timeOff.length === 0 && selectedDayData.wfh.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400">Everyone is in the office! 🎉</p>
          )}
        </div>
      )}
    </div>
  )
}

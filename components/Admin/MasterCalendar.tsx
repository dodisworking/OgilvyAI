'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, getDay, isWeekend } from 'date-fns'

interface UserSchedule {
  userId: string
  userName: string
  profilePicture?: string | null
  color?: string
  requests: {
    id: string
    startDate: string
    endDate: string
    requestType: 'WFH' | 'TIME_OFF' | 'BOTH'
    status: string
    dayBreakdown?: Record<string, string>
  }[]
}

// Color palette for users
const USER_COLORS = [
  { bg: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-500', light: 'bg-rose-100' },
  { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500', light: 'bg-blue-100' },
  { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-100' },
  { bg: 'bg-violet-500', border: 'border-violet-500', text: 'text-violet-500', light: 'bg-violet-100' },
  { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-500', light: 'bg-amber-100' },
  { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-500', light: 'bg-cyan-100' },
  { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-500', light: 'bg-pink-100' },
  { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-100' },
  { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500', light: 'bg-orange-100' },
  { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-500', light: 'bg-teal-100' },
]

export default function MasterCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [userSchedules, setUserSchedules] = useState<UserSchedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [hoveredUser, setHoveredUser] = useState<string | null>(null)

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

  // Assign colors to users
  const usersWithColors = useMemo(() => {
    return userSchedules.map((user, idx) => ({
      ...user,
      color: USER_COLORS[idx % USER_COLORS.length]
    }))
  }, [userSchedules])

  // Create a map of userId -> color
  const userColorMap = useMemo(() => {
    const map: Record<string, typeof USER_COLORS[0]> = {}
    usersWithColors.forEach(user => {
      map[user.userId] = user.color!
    })
    return map
  }, [usersWithColors])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDayOfWeek = getDay(monthStart)
  const paddingDays = Array(startDayOfWeek).fill(null)

  // Build a map of date -> users with events (now with type info)
  const dateEventsMap = useMemo(() => {
    const map: Record<string, { user: UserSchedule, type: 'WFH' | 'TIME_OFF' }[]> = {}
    
    usersWithColors.forEach(user => {
      user.requests.forEach(request => {
        if (request.status !== 'APPROVED') return
        
        const start = new Date(request.startDate)
        const end = new Date(request.endDate)
        const days = eachDayOfInterval({ start, end })
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd')
          if (!map[dateStr]) {
            map[dateStr] = []
          }
          
          let dayType = request.requestType
          if (request.dayBreakdown && request.dayBreakdown[dateStr]) {
            dayType = request.dayBreakdown[dateStr] as 'WFH' | 'TIME_OFF'
          }
          
          // Don't add duplicates
          if (!map[dateStr].find(e => e.user.userId === user.userId)) {
            if (dayType === 'BOTH') {
              map[dateStr].push({ user, type: 'TIME_OFF' })
            } else {
              map[dateStr].push({ user, type: dayType as 'WFH' | 'TIME_OFF' })
            }
          }
        })
      })
    })
    
    return map
  }, [usersWithColors])

  const selectedDayData = selectedDay ? dateEventsMap[selectedDay] : null

  // Get users who have any approved requests this month
  const activeUsers = useMemo(() => {
    return usersWithColors.filter(user => 
      user.requests.some(req => req.status === 'APPROVED')
    )
  }, [usersWithColors])

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Team Coverage Calendar
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
              className="px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors font-medium"
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
        <h3 className="text-xl font-semibold text-center mt-4 text-gray-700 dark:text-gray-200">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
      </div>

      <div className="flex">
        {/* Team Legend Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Team Members</h4>
          
          {/* Legend for types */}
          <div className="flex gap-4 mb-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-500">Time Off</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-500">WFH</span>
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {activeUsers.length === 0 ? (
              <p className="text-sm text-gray-400">No scheduled time off</p>
            ) : (
              activeUsers.map(user => (
                <div
                  key={user.userId}
                  onMouseEnter={() => setHoveredUser(user.userId)}
                  onMouseLeave={() => setHoveredUser(null)}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                    hoveredUser === user.userId ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  <div className={`relative`}>
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={user.userName}
                        className={`w-10 h-10 rounded-full object-cover border-3 ${user.color?.border}`}
                        style={{ borderWidth: '3px' }}
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full ${user.color?.bg} flex items-center justify-center text-white font-bold`}
                      >
                        {user.userName[0]?.toUpperCase()}
                      </div>
                    )}
                    {/* Color indicator dot */}
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${user.color?.bg} border-2 border-white dark:border-gray-800`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800 dark:text-white truncate">
                      {user.userName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {user.requests.filter(r => r.status === 'APPROVED').length} scheduled
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 p-4">
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
                <div key={`pad-${idx}`} className="min-h-[100px]"></div>
              ))}
              
              {/* Calendar days */}
              {daysInMonth.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const events = dateEventsMap[dateStr] || []
                const isWeekendDay = isWeekend(day)
                const isSelected = selectedDay === dateStr
                
                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`
                      min-h-[100px] p-2 rounded-lg cursor-pointer transition-all border-2
                      ${isToday(day) ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent'}
                      ${isSelected ? 'ring-2 ring-purple-400 bg-purple-50 dark:bg-purple-900/30' : ''}
                      ${isWeekendDay ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-800'}
                      hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className={`text-sm font-medium mb-2 ${isToday(day) ? 'text-purple-600' : 'text-gray-700 dark:text-gray-300'}`}>
                      {format(day, 'd')}
                    </div>
                    
                    {/* Profile bubbles */}
                    <div className="flex flex-wrap gap-1">
                      {events.slice(0, 4).map(({ user, type }) => {
                        const color = userColorMap[user.userId]
                        const isHighlighted = hoveredUser === user.userId
                        
                        return (
                          <div
                            key={user.userId}
                            className={`relative transition-transform ${isHighlighted ? 'scale-125 z-10' : ''}`}
                            title={`${user.userName} - ${type === 'TIME_OFF' ? 'Time Off' : 'WFH'}`}
                          >
                            {user.profilePicture ? (
                              <img
                                src={user.profilePicture}
                                alt={user.userName}
                                className={`w-7 h-7 rounded-full object-cover border-2 ${
                                  type === 'TIME_OFF' ? 'border-red-500' : 'border-blue-500'
                                }`}
                              />
                            ) : (
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${color?.bg}`}
                                style={{
                                  boxShadow: type === 'TIME_OFF' 
                                    ? '0 0 0 2px #ef4444' 
                                    : '0 0 0 2px #3b82f6'
                                }}
                              >
                                {user.userName[0]?.toUpperCase()}
                              </div>
                            )}
                            {/* Type indicator */}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white ${
                              type === 'TIME_OFF' ? 'bg-red-500' : 'bg-blue-500'
                            }`}></div>
                          </div>
                        )
                      })}
                      {events.length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                          +{events.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Selected Day Detail */}
          {selectedDay && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <h4 className="font-semibold text-lg mb-3 text-gray-800 dark:text-white">
                {format(new Date(selectedDay), 'EEEE, MMMM d, yyyy')}
              </h4>
              
              {selectedDayData && selectedDayData.length > 0 ? (
                <div className="space-y-3">
                  {/* Time Off */}
                  {selectedDayData.filter(e => e.type === 'TIME_OFF').length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-red-500"></span>
                        Time Off ({selectedDayData.filter(e => e.type === 'TIME_OFF').length})
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedDayData.filter(e => e.type === 'TIME_OFF').map(({ user }) => (
                          <div key={user.userId} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-full">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt={user.userName} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className={`w-8 h-8 rounded-full ${userColorMap[user.userId]?.bg} flex items-center justify-center text-sm font-bold text-white`}>
                                {user.userName[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium text-red-800 dark:text-red-200">{user.userName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* WFH */}
                  {selectedDayData.filter(e => e.type === 'WFH').length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        Working From Home ({selectedDayData.filter(e => e.type === 'WFH').length})
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {selectedDayData.filter(e => e.type === 'WFH').map(({ user }) => (
                          <div key={user.userId} className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-3 py-2 rounded-full">
                            {user.profilePicture ? (
                              <img src={user.profilePicture} alt={user.userName} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className={`w-8 h-8 rounded-full ${userColorMap[user.userId]?.bg} flex items-center justify-center text-sm font-bold text-white`}>
                                {user.userName[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">{user.userName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                  <span className="text-2xl">🎉</span>
                  <span className="font-medium">Everyone is in the office!</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

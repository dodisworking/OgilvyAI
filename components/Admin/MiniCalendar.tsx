'use client'

import { useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek, addDays, subDays, isSameDay } from 'date-fns'
import { Request } from '@/types'

interface MiniCalendarProps {
  request: Request
}

export default function MiniCalendar({ request }: MiniCalendarProps) {
  const startDate = new Date(request.startDate)
  const endDate = new Date(request.endDate)
  
  // Determine the calendar month to show (start with the month containing the start date)
  const calendarMonth = useMemo(() => {
    return startOfMonth(startDate)
  }, [startDate])
  
  // Get all days in the month that should be displayed
  const monthStart = startOfMonth(calendarMonth)
  const monthEnd = endOfMonth(calendarMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  
  // Create a set of selected dates for quick lookup
  const selectedDatesSet = useMemo(() => {
    const dates = eachDayOfInterval({ start: startDate, end: endDate })
    return new Set(dates.map(d => format(d, 'yyyy-MM-dd')))
  }, [startDate, endDate])
  
  // Get day-by-day breakdown if available - handle JSON parsing
  const dayBreakdown = useMemo(() => {
    if (!request.dayBreakdown) {
      return {}
    }
    
    // Prisma JSON fields come as objects, but handle both string and object
    let parsed: any = null
    if (typeof request.dayBreakdown === 'string') {
      try {
        parsed = JSON.parse(request.dayBreakdown)
      } catch (e) {
        console.error('Failed to parse dayBreakdown:', e)
        return {}
      }
    } else {
      parsed = request.dayBreakdown
    }
    
    // Ensure it's an object
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    
    // Convert to proper format - ensure all keys are strings and values are valid
    const validBreakdown: Record<string, 'TIME_OFF' | 'WFH'> = {}
    Object.keys(parsed).forEach(key => {
      const value = parsed[key]
      // Normalize the key to ensure it's a string in yyyy-MM-dd format
      const normalizedKey = String(key)
      if (value === 'TIME_OFF' || value === 'WFH') {
        validBreakdown[normalizedKey] = value
      }
    })
    
    // Debug: Log breakdown for troubleshooting
    if (Object.keys(validBreakdown).length > 0 && request.requestType === 'BOTH') {
      console.log(`[MiniCalendar] Request ${request.id} dayBreakdown:`, validBreakdown)
      console.log(`[MiniCalendar] Request dates: ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`)
    }
    
    return validBreakdown
  }, [request.dayBreakdown, request.id, request.requestType, startDate, endDate])
  
  const isSelected = (day: Date) => {
    return selectedDatesSet.has(format(day, 'yyyy-MM-dd'))
  }
  
  const isInMonth = (day: Date) => {
    return isSameMonth(day, calendarMonth)
  }
  
  // Determine colors based on request type and day breakdown
  const getDayColors = (day: Date) => {
    if (!isSelected(day)) {
      return {
        bg: 'bg-gray-50 dark:bg-gray-800',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-400 dark:text-gray-600'
      }
    }
    
    const dayKey = format(day, 'yyyy-MM-dd')
    
    // Always check dayBreakdown first if it exists and has this day
    // For BOTH requests, we MUST use the breakdown to show individual day colors
    if (dayBreakdown && typeof dayBreakdown === 'object' && Object.keys(dayBreakdown).length > 0) {
      // Check if this specific day exists in the breakdown
      // Try both the exact key and check all keys to see if there's a format mismatch
      let dayTypeFromBreakdown = dayBreakdown[dayKey]
      
      // If not found with exact key, try to find it (in case of format mismatch)
      if (!dayTypeFromBreakdown) {
        // Check all keys to see if there's a match - try different date formats
        for (const key in dayBreakdown) {
          // First try exact string match
          if (key === dayKey) {
            dayTypeFromBreakdown = dayBreakdown[key]
            break
          }
          
          // Try parsing as date and comparing
          try {
            const keyDate = new Date(key)
            // Check if it's a valid date and matches our day
            if (!isNaN(keyDate.getTime()) && isSameDay(keyDate, day)) {
              dayTypeFromBreakdown = dayBreakdown[key]
              break
            }
          } catch {
            // If parsing fails, continue to next key
            continue
          }
        }
      }
      
      // If we found the day type in breakdown, use it
      if (dayTypeFromBreakdown === 'TIME_OFF' || dayTypeFromBreakdown === 'WFH') {
        switch (dayTypeFromBreakdown) {
          case 'TIME_OFF':
            return {
              bg: 'bg-red-200 dark:bg-red-900/40',
              border: 'border-red-300 dark:border-red-700',
              text: 'text-red-800 dark:text-red-200'
            }
          case 'WFH':
            return {
              bg: 'bg-blue-200 dark:bg-blue-900/40',
              border: 'border-blue-300 dark:border-blue-700',
              text: 'text-blue-800 dark:text-blue-200'
            }
        }
      }
    }
    
    // Fallback to request type if no breakdown for this specific day
    // This handles older requests without breakdown data
    switch (request.requestType) {
      case 'TIME_OFF':
        return {
          bg: 'bg-red-200 dark:bg-red-900/40',
          border: 'border-red-300 dark:border-red-700',
          text: 'text-red-800 dark:text-red-200'
        }
      case 'WFH':
        return {
          bg: 'bg-blue-200 dark:bg-blue-900/40',
          border: 'border-blue-300 dark:border-blue-700',
          text: 'text-blue-800 dark:text-blue-200'
        }
      case 'BOTH':
        // If it's BOTH but no breakdown, show gradient as fallback
        return {
          bg: 'bg-gradient-to-br from-red-200 to-blue-200 dark:from-red-900/40 dark:to-blue-900/40',
          border: 'border-purple-300 dark:border-purple-700',
          text: 'text-purple-800 dark:text-purple-200'
        }
      default:
        return {
          bg: 'bg-gray-200 dark:bg-gray-700',
          border: 'border-gray-300 dark:border-gray-600',
          text: 'text-gray-800 dark:text-gray-200'
        }
    }
  }
  
  return (
    <div className="w-full max-w-[240px]">
      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">
        {format(calendarMonth, 'MMMM yyyy')}
      </div>
      
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div 
            key={idx} 
            className="text-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 py-0.5"
          >
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, idx) => {
          const colors = getDayColors(day)
          const selected = isSelected(day)
          const inMonth = isInMonth(day)
          
          return (
            <div
              key={idx}
              className={`
                aspect-square text-[10px] font-medium rounded border transition-all
                ${colors.bg}
                ${colors.border}
                ${colors.text}
                ${!inMonth ? 'opacity-30' : ''}
                ${selected ? 'ring-1 ring-offset-1' : ''}
              `}
              title={selected ? format(day, 'MMM d, yyyy') : undefined}
            >
              <div className="h-full flex items-center justify-center">
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Legend for BOTH type or if breakdown exists */}
      {(request.requestType === 'BOTH' || Object.keys(dayBreakdown).length > 0) && (
        <div className="mt-2 text-[9px] text-center text-gray-500 dark:text-gray-400">
          Red = Time Off, Blue = Work From Home
          {Object.keys(dayBreakdown).length === 0 && request.requestType === 'BOTH' && (
            <span className="block mt-1 text-red-500">⚠ No breakdown data available</span>
          )}
        </div>
      )}
    </div>
  )
}

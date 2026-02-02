'use client'

import { useState, useMemo } from 'react'
import { format, eachDayOfInterval } from 'date-fns'
import { Request } from '@/types'
import InteractiveCalendar from './InteractiveCalendar'

interface EditRequestFormProps {
  request: Request
  onClose: () => void
  onSuccess: () => void
}

export default function EditRequestForm({ request, onClose, onSuccess }: EditRequestFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Pre-populate selected days from the existing request
  const initialSelectedDays = useMemo(() => {
    const days = new Map<string, 'TIME_OFF' | 'WFH'>()
    const startDate = new Date(request.startDate)
    const endDate = new Date(request.endDate)
    const requestType = request.requestType as 'TIME_OFF' | 'WFH'
    
    // Add all days in the range to the map
    const daysInRange = eachDayOfInterval({ start: startDate, end: endDate })
    daysInRange.forEach(day => {
      days.set(format(day, 'yyyy-MM-dd'), requestType)
    })
    
    return days
  }, [request])

  const handleDatesSelected = async (dateRanges: {
    startDate: Date
    endDate: Date
    requestType: 'TIME_OFF' | 'WFH' | 'BOTH'
    title?: string
    reason?: string
    dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'>
  }[]) => {
    if (dateRanges.length === 0) {
      setError('Please select at least one day')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // For editing a single request, we need to combine all ranges
      // Find the earliest start date and latest end date
      const sortedRanges = dateRanges.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      const earliestStart = sortedRanges[0].startDate
      const latestEnd = sortedRanges[sortedRanges.length - 1].endDate
      
      // Determine the primary request type (use the first range's type, or both if mixed)
      const primaryType = sortedRanges[0].requestType
      
      // Get title, reason, and dayBreakdown from the first range (they should be the same)
      const title = sortedRanges[0].title
      const reason = sortedRanges[0].reason
      const dayBreakdown = sortedRanges[0].dayBreakdown
      
      const response = await fetch(`/api/requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          startDate: earliestStart.toISOString(),
          endDate: latestEnd.toISOString(),
          requestType: primaryType,
          title: title || null,
          reason: reason || null,
          dayBreakdown: dayBreakdown || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update request')
      }

      alert('Request updated and resubmitted to Tim for review!')
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to update request')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl z-10"
        >
          ×
        </button>

        <h2 className="text-xl font-bold mb-4">Edit Request</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        <InteractiveCalendar
          initialBrush={request.requestType as 'TIME_OFF' | 'WFH'}
          userName=""
          initialSelectedDays={initialSelectedDays}
          initialTitle={request.title || ''}
          initialReason={request.reason || ''}
          onDatesSelected={handleDatesSelected}
          onCancel={onClose}
        />

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Updating this request will resubmit it to Tim for review with PENDING status
        </p>
      </div>
    </div>
  )
}

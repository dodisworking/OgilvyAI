'use client'

import { useState } from 'react'
import DatePicker from 'react-datepicker'
import Button from '../UI/Button'
import { RequestType } from '@/types'

// Import datepicker styles
if (typeof window !== 'undefined') {
  require('react-datepicker/dist/react-datepicker.css')
}

interface RequestFormProps {
  onSubmit: (data: {
    startDate: Date
    endDate: Date
    requestType: RequestType
    reason?: string
  }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export default function RequestForm({ onSubmit, onCancel, isLoading }: RequestFormProps) {
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [requestType, setRequestType] = useState<RequestType>('TIME_OFF')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    if (startDate > endDate) {
      setError('End date must be after start date')
      return
    }

    try {
      await onSubmit({
        startDate,
        endDate,
        requestType,
        reason: reason.trim() || undefined,
      })
      
      // Reset form
      setStartDate(null)
      setEndDate(null)
      setRequestType('TIME_OFF')
      setReason('')
    } catch (err: any) {
      setError(err.message || 'Failed to submit request')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative my-8">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Request Time Off / Work From Home
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Request Type
            </label>
            <div className="grid grid-cols-3 gap-4">
              {(['TIME_OFF', 'WFH', 'BOTH'] as RequestType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRequestType(type)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    requestType === type
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                >
                  {type === 'TIME_OFF' ? 'Time Off' : type === 'WFH' ? 'Work From Home' : 'Both'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Start Date
              </label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate}
                endDate={endDate}
                className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
                placeholderText="Select start date"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                End Date
              </label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || undefined}
                className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
                placeholderText="Select end date"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium mb-2">
              Reason (Optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
              placeholder="Add any additional details..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading} className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
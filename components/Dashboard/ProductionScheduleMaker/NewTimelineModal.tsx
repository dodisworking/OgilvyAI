'use client'

import { useState } from 'react'
import { format, startOfMonth } from 'date-fns'

interface NewTimelineModalProps {
  onClose: () => void
  onCreate: (name: string, startMonth: Date) => Promise<void>
}

export default function NewTimelineModal({ onClose, onCreate }: NewTimelineModalProps) {
  const [timelineName, setTimelineName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [startMonth, setStartMonth] = useState(startOfMonth(new Date()))

  const handleCreate = async () => {
    if (!timelineName.trim()) {
      alert('Please enter a timeline name')
      return
    }

    setIsCreating(true)
    try {
      await onCreate(timelineName.trim(), startMonth)
    } catch (error) {
      console.error('Error creating timeline:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to create timeline: ${errorMessage}\n\nPlease check the console for more details.`)
      setIsCreating(false)
    }
  }
  
  // Generate month options (current month and next 11 months)
  const getMonthOptions = () => {
    const options: Date[] = []
    const today = new Date()
    for (let i = -6; i <= 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() + i, 1)
      options.push(date)
    }
    return options
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-4">Create New Timeline</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Give your production timeline a name
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Timeline Name</label>
          <input
            type="text"
            value={timelineName}
            onChange={(e) => setTimelineName(e.target.value)}
            placeholder="Enter timeline name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && timelineName.trim()) {
                handleCreate()
              }
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Start Month</label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Which month should this production timeline start with?
          </p>
          <select
            value={format(startMonth, 'yyyy-MM')}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-').map(Number)
              setStartMonth(new Date(year, month - 1, 1))
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
          >
            {getMonthOptions().map((month) => (
              <option key={format(month, 'yyyy-MM')} value={format(month, 'yyyy-MM')}>
                {format(month, 'MMMM yyyy')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !timelineName.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

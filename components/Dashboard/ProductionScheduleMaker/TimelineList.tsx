'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface TimelineListProps {
  onSelectTimeline: (timelineId: string) => void
  onCreateNew: () => void
}

export default function TimelineList({ onSelectTimeline, onCreateNew }: TimelineListProps) {
  const [timelines, setTimelines] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTimelines()
  }, [])

  const loadTimelines = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/production-schedule', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setTimelines(data.timelines || [])
      }
    } catch (error) {
      console.error('Error loading timelines:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (timelineId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this timeline?')) return

    try {
      const response = await fetch(`/api/production-schedule?id=${timelineId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        loadTimelines()
      }
    } catch (error) {
      console.error('Error deleting timeline:', error)
      alert('Failed to delete timeline')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl md:text-2xl font-bold">Your Timelines</h2>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium text-sm"
        >
          + New Timeline
        </button>
      </div>

      {timelines.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No timelines yet. Create your first one!
          </p>
          <button
            onClick={onCreateNew}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
          >
            Create New Timeline
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {timelines.map((timeline) => (
            <div
              key={timeline.id}
              onClick={() => onSelectTimeline(timeline.id)}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 cursor-pointer transition-all relative"
            >
              <button
                onClick={(e) => handleDelete(timeline.id, e)}
                className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-lg"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-2 pr-6">{timeline.title}</h3>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Updated: {format(new Date(timeline.updatedAt), 'MMM d, yyyy')}</p>
                <p>Created: {format(new Date(timeline.createdAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

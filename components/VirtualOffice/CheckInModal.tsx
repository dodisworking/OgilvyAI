'use client'

import { useState } from 'react'
import Button from '../UI/Button'

interface CheckInModalProps {
  onCheckIn: (teamsLink: string) => void
  onClose: () => void
  existingLink?: string | null
}

export default function CheckInModal({ onCheckIn, onClose, existingLink }: CheckInModalProps) {
  const [teamsLink, setTeamsLink] = useState(existingLink || '')
  const [meetingId, setMeetingId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!teamsLink && !meetingId) {
      setError('Please enter either a Teams link or Meeting ID')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/virtual-office/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          teamsLink: teamsLink || undefined,
          meetingId: meetingId || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check in')
      }

      // Use the link from response or construct it
      const finalLink = data.checkIn?.teamsLink || teamsLink
      onCheckIn(finalLink)
    } catch (err: any) {
      setError(err.message || 'Failed to check in')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>

        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Check In to Virtual Office
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
            Enter your Teams meeting link to join the virtual office
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="teamsLink" className="block text-sm font-medium mb-2">
              Teams Meeting Link:
            </label>
            <input
              id="teamsLink"
              type="text"
              value={teamsLink}
              onChange={(e) => setTeamsLink(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">OR</span>
            </div>
          </div>

          <div>
            <label htmlFor="meetingId" className="block text-sm font-medium mb-2">
              Meeting ID:
            </label>
            <input
              id="meetingId"
              type="text"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="abc-defg-hij"
              className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Just the meeting ID (we&apos;ll create the link for you)
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              isLoading={isLoading}
            >
              {existingLink ? 'Update' : 'Check In'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import Button from '../UI/Button'

interface ApprovalActionsProps {
  requestId: string
  onSuccess: () => void
  onCancel: () => void
}

export default function ApprovalActions({ requestId, onSuccess, onCancel }: ApprovalActionsProps) {
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAction = async (status: 'APPROVED' | 'REJECTED') => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/requests/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Ensure cookies are sent
        body: JSON.stringify({
          requestId,
          status,
          adminNotes: notes.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update request')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-2">
          Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="Add any notes or comments..."
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleAction('APPROVED')}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Approve'}
        </button>
        <button
          onClick={() => handleAction('REJECTED')}
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : 'Reject'}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
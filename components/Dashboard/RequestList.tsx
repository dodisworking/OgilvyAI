'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Request } from '@/types'
import StatusBadge from './StatusBadge'
import EditRequestForm from './EditRequestForm'

interface RequestListProps {
  requests: Request[]
  onUpdate?: () => void
}

export default function RequestList({ requests, onUpdate }: RequestListProps) {
  const [editingRequest, setEditingRequest] = useState<Request | null>(null)
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null)

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) {
      return
    }

    setDeletingRequestId(requestId)
    try {
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete request')
      }

      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete request')
    } finally {
      setDeletingRequestId(null)
    }
  }

  const handleEdit = (request: Request) => {
    setEditingRequest(request)
  }

  const handleEditComplete = () => {
    setEditingRequest(null)
    if (onUpdate) {
      onUpdate()
    }
  }
  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'WFH': return 'Work From Home'
      case 'TIME_OFF': return 'Time Off'
      case 'BOTH': return 'Time Off & Work From Home'
      default: return type
    }
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No requests yet</p>
        <p className="text-sm mt-2">Submit your first request to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div
          key={request.id}
          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 flex-1">
              {request.user?.profilePicture ? (
                <img
                  src={request.user.profilePicture}
                  alt={request.user?.name || 'You'}
                  className="w-12 h-12 rounded-full object-cover border-2 border-purple-300 flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {(request.user?.name || 'Y')[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{request.title || getRequestTypeLabel(request.requestType)}</h3>
                {request.title && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    {getRequestTypeLabel(request.requestType)}
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <StatusBadge status={request.status as any} />
          </div>

          {request.reason && (
            <p className="text-gray-700 dark:text-gray-300 mb-3">{request.reason}</p>
          )}

          {request.adminNotes && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Admin Notes:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{request.adminNotes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleEdit(request)}
              className="px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all font-medium text-sm"
            >
              Edit
            </button>
            <button
              onClick={() => handleDelete(request.id)}
              disabled={deletingRequestId === request.id}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all font-medium text-sm disabled:opacity-50"
            >
              {deletingRequestId === request.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Submitted {format(new Date(request.createdAt), 'MMM d, yyyy')}
          </p>
        </div>
      ))}

      {/* Edit Request Modal */}
      {editingRequest && (
        <EditRequestForm
          request={editingRequest}
          onClose={handleEditComplete}
          onSuccess={handleEditComplete}
        />
      )}
    </div>
  )
}
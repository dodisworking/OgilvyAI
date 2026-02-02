'use client'

import React, { useState } from 'react'
import { format } from 'date-fns'
import { Request } from '@/types'
import StatusBadge from '../Dashboard/StatusBadge'
import ApprovalActions from './ApprovalActions'
import MiniCalendar from './MiniCalendar'

interface RequestCardProps {
  request: Request
  onUpdate: () => void
}

export default function RequestCard({ request, onUpdate }: RequestCardProps) {
  const [showActions, setShowActions] = useState(false)

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'WFH': return 'Work From Home'
      case 'TIME_OFF': return 'Time Off'
      case 'BOTH': return 'WFH & Time Off'
      default: return type
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow border-l-4 border-purple-500">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">{request.title || getRequestTypeLabel(request.requestType)}</h3>
            <StatusBadge status={request.status as any} />
          </div>
          {request.title && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {getRequestTypeLabel(request.requestType)}
            </p>
          )}
          <div className="flex items-center gap-3 mb-2">
            {request.user?.profilePicture ? (
              <img
                src={request.user.profilePicture}
                alt={request.user?.name || 'User'}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-300"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white font-semibold text-sm">
                {(request.user?.name || 'U')[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {request.user?.name || 'Unknown'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {request.user?.email || 'N/A'}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Date Range:</strong> {format(new Date(request.startDate), 'MMM d, yyyy')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
          </p>
        </div>
        
        {/* Mini Calendar */}
        <div className="flex-shrink-0">
          <MiniCalendar request={request} />
        </div>
      </div>

      {request.reason && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason:</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{request.reason}</p>
        </div>
      )}

      {request.adminNotes && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Admin Notes:</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">{request.adminNotes}</p>
        </div>
      )}

      {request.status === 'PENDING' && (
        <div className="mt-4">
          {!showActions ? (
            <button
              onClick={() => setShowActions(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all"
            >
              Review Request
            </button>
          ) : (
            <ApprovalActions
              requestId={request.id}
              onSuccess={() => {
                setShowActions(false)
                onUpdate()
              }}
              onCancel={() => setShowActions(false)}
            />
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
        Submitted {format(new Date(request.createdAt), 'MMM d, yyyy')}
      </p>
    </div>
  )
}
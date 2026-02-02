'use client'

import React from 'react'
import { RequestStatus } from '@/types'

interface StatusBadgeProps {
  status: RequestStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    APPROVED: 'bg-green-100 text-green-800 border-green-300',
    REJECTED: 'bg-red-100 text-red-800 border-red-300',
  }

  const statusLabels = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  )
}
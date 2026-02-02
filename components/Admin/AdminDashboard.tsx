'use client'

import React, { useState, useEffect } from 'react'
import { Request } from '@/types'
import RequestCard from './RequestCard'

interface AdminDashboardProps {
  requests: Request[]
  onRefresh: () => void
}

export default function AdminDashboard({ requests, onRefresh }: AdminDashboardProps) {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRequests = requests.filter((request) => {
    const matchesFilter = filter === 'ALL' || request.status === filter
    const matchesSearch = searchTerm === '' || 
      request.user?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const pendingCount = requests.filter(r => r.status === 'PENDING').length
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length
  const rejectedCount = requests.filter(r => r.status === 'REJECTED').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">{requests.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 shadow-md border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{pendingCount}</div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 shadow-md border-l-4 border-green-500">
          <div className="text-2xl font-bold text-green-700 dark:text-green-300">{approvedCount}</div>
          <div className="text-sm text-green-600 dark:text-green-400">Approved</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow-md border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300">{rejectedCount}</div>
          <div className="text-sm text-red-600 dark:text-red-400">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by employee name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-700 focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === status
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-lg">No requests found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onUpdate={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  )
}
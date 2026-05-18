'use client'

import React, { useState, useEffect } from 'react'
import { Request } from '@/types'
import RequestCard from './RequestCard'
import MasterCalendar from './MasterCalendar'

interface AdminDashboardProps {
  requests: Request[]
  onRefresh: () => void
  enableTeamCalendarEdit?: boolean
  teamCalendarApiEndpoint?: string
  /** Tim App / small screens: tighter layout, full-height scroll */
  variant?: 'default' | 'mobile'
  /** When set, approval is sent as Isaac with this code (used inside Isaac Mode). */
  forceIsaacCode?: string
}

export default function AdminDashboard({
  requests,
  onRefresh,
  enableTeamCalendarEdit = false,
  teamCalendarApiEndpoint,
  variant = 'default',
  forceIsaacCode,
}: AdminDashboardProps) {
  const isMobile = variant === 'mobile'
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [showMasterCalendar, setShowMasterCalendar] = useState(false)
  const [isCalendarEditMode, setIsCalendarEditMode] = useState(false)

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
    <div
      className={`flex flex-col ${
        isMobile
          ? 'min-h-0 flex-1 space-y-3'
          : 'max-h-[calc(100vh-200px)] space-y-6'
      }`}
    >
      {/* Stats */}
      <div
        className={`grid flex-shrink-0 gap-3 ${
          isMobile ? 'grid-cols-2' : 'grid-cols-1 gap-4 md:grid-cols-4'
        }`}
      >
        <div
          className={`rounded-lg bg-white shadow-md dark:bg-gray-800 ${isMobile ? 'p-3' : 'p-6'}`}
        >
          <div
            className={`font-bold text-gray-800 dark:text-gray-200 ${isMobile ? 'text-xl' : 'text-2xl'}`}
          >
            {requests.length}
          </div>
          <div className={`text-gray-600 dark:text-gray-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Total
          </div>
        </div>
        <div
          className={`rounded-lg border-l-4 border-yellow-500 bg-yellow-50 shadow-md dark:bg-yellow-900/20 ${
            isMobile ? 'p-3' : 'p-6'
          }`}
        >
          <div
            className={`font-bold text-yellow-700 dark:text-yellow-300 ${isMobile ? 'text-xl' : 'text-2xl'}`}
          >
            {pendingCount}
          </div>
          <div className={`text-yellow-600 dark:text-yellow-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Pending
          </div>
        </div>
        <div
          className={`rounded-lg border-l-4 border-green-500 bg-green-50 shadow-md dark:bg-green-900/20 ${
            isMobile ? 'p-3' : 'p-6'
          }`}
        >
          <div
            className={`font-bold text-green-700 dark:text-green-300 ${isMobile ? 'text-xl' : 'text-2xl'}`}
          >
            {approvedCount}
          </div>
          <div className={`text-green-600 dark:text-green-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Approved
          </div>
        </div>
        <div
          className={`rounded-lg border-l-4 border-red-500 bg-red-50 shadow-md dark:bg-red-900/20 ${
            isMobile ? 'p-3' : 'p-6'
          }`}
        >
          <div
            className={`font-bold text-red-700 dark:text-red-300 ${isMobile ? 'text-xl' : 'text-2xl'}`}
          >
            {rejectedCount}
          </div>
          <div className={`text-red-600 dark:text-red-400 ${isMobile ? 'text-xs' : 'text-sm'}`}>
            Rejected
          </div>
        </div>
      </div>

      {/* Filters */}
      <div
        className={`flex-shrink-0 rounded-lg bg-white shadow-md dark:bg-gray-800 ${isMobile ? 'p-3' : 'p-4'}`}
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder={
                isMobile ? 'Search name or email…' : 'Search by employee name or email...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-200 px-4 py-2 transition-colors focus:border-purple-500 focus:outline-none dark:border-gray-700"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`rounded-lg px-4 py-2 font-medium transition-all ${
                  filter === status
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                } ${isMobile ? 'px-3 py-1.5 text-sm' : ''}`}
              >
                {status}
              </button>
            ))}
            {!isMobile && (
              <button
                type="button"
                onClick={() => setShowMasterCalendar(true)}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:from-purple-700 hover:to-pink-700"
              >
                <span>📅</span> Team Calendar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Requests List — single requests render flat, batched requests are
          grouped into a "Batch from X — N requests" wrapper. */}
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 ${isMobile ? 'pb-2' : 'pr-2'}`}
      >
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-lg">No requests found</p>
            <p className="text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          (() => {
            const seenBatches = new Set<string>()
            const out: React.ReactNode[] = []
            for (const request of filteredRequests) {
              const bid = request.batchId
              if (bid && !seenBatches.has(bid)) {
                seenBatches.add(bid)
                const siblings = filteredRequests.filter((r) => r.batchId === bid)
                if (siblings.length > 1) {
                  const submitter = siblings[0].user?.name || 'Someone'
                  out.push(
                    <div
                      key={`batch-${bid}`}
                      className="rounded-2xl border-2 border-orange-200 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-900/10 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <span className="text-base">📦</span>
                        <p className="text-sm font-bold text-orange-800 dark:text-orange-200">
                          Batch from {submitter}
                        </p>
                        <span className="text-xs text-orange-700/70 dark:text-orange-300/70">
                          {siblings.length} requests — approve or reject each separately
                        </span>
                      </div>
                      <div className="space-y-3">
                        {siblings.map((sib) => (
                          <RequestCard
                            key={sib.id}
                            request={sib}
                            onUpdate={onRefresh}
                            compactCalendarModal={isMobile}
                            forceIsaacCode={forceIsaacCode}
                          />
                        ))}
                      </div>
                    </div>
                  )
                  continue
                }
              } else if (bid && seenBatches.has(bid)) {
                // Already rendered as part of its batch group above.
                continue
              }
              out.push(
                <RequestCard
                  key={request.id}
                  request={request}
                  onUpdate={onRefresh}
                  compactCalendarModal={isMobile}
                  forceIsaacCode={forceIsaacCode}
                />
              )
            }
            return out
          })()
        )}
      </div>

      {/* Master Calendar Modal */}
      {showMasterCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <span>📅</span> Team Coverage Calendar
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  View all approved time off and work from home schedules
                </p>
              </div>
              <button
              onClick={() => {
                setShowMasterCalendar(false)
                setIsCalendarEditMode(false)
              }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Master Calendar */}
            <div className="flex-1 overflow-auto p-4">
              <MasterCalendar
                requestsData={requests}
                apiEndpoint={teamCalendarApiEndpoint}
                editable={enableTeamCalendarEdit && isCalendarEditMode}
                updateEndpoint="/api/admin/requests"
                showEditButton={enableTeamCalendarEdit}
                allowPendingApproval={enableTeamCalendarEdit}
                onRequestUpdated={onRefresh}
                forceIsaacCode={forceIsaacCode}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              {enableTeamCalendarEdit ? (
                <button
                  onClick={() => setIsCalendarEditMode((prev) => !prev)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isCalendarEditMode
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isCalendarEditMode ? 'Done Editing' : 'Edit Calendar'}
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => {
                  setShowMasterCalendar(false)
                  setIsCalendarEditMode(false)
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Close Calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
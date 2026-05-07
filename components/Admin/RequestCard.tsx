'use client'

import React, { useState, useEffect } from 'react'
import { format, eachDayOfInterval, isWithinInterval, addDays, subDays } from 'date-fns'
import { Request } from '@/types'
import StatusBadge from '../Dashboard/StatusBadge'
import ApprovalActions from './ApprovalActions'
import MiniCalendar from './MiniCalendar'
import MasterCalendar from './MasterCalendar'

interface TeamMemberSchedule {
  userId: string
  userName: string
  profilePicture?: string | null
  requests: {
    id: string
    startDate: string
    endDate: string
    requestType: 'WFH' | 'TIME_OFF' | 'BOTH'
    status: string
    dayBreakdown?: Record<string, string>
  }[]
}

interface RequestCardProps {
  request: Request
  onUpdate: () => void
  /** Tim App / iPhone: bottom sheet + limited height instead of full-screen desktop modal */
  compactCalendarModal?: boolean
  /** When set, approval is sent as Isaac with this code (used inside Isaac Mode). */
  forceIsaacCode?: string
}

export default function RequestCard({ request, onUpdate, compactCalendarModal = false, forceIsaacCode }: RequestCardProps) {
  const [showActions, setShowActions] = useState(false)
  const [teamContext, setTeamContext] = useState<TeamMemberSchedule[]>([])
  const [loadingContext, setLoadingContext] = useState(false)
  const [showMasterCalendar, setShowMasterCalendar] = useState(false)

  // Fetch team context when showing actions
  useEffect(() => {
    if (showActions && request.status === 'PENDING') {
      fetchTeamContext()
    }
  }, [showActions])

  const fetchTeamContext = async () => {
    setLoadingContext(true)
    try {
      const response = await fetch('/api/admin/master-calendar')
      if (response.ok) {
        const data = await response.json()
        // Filter out the current requester and only show users with approved requests
        const otherUsers = data.schedules.filter(
          (s: TeamMemberSchedule) => s.userId !== request.userId && 
          s.requests.some((r: any) => r.status === 'APPROVED')
        )
        setTeamContext(otherUsers)
      }
    } catch (error) {
      console.error('Failed to fetch team context:', error)
    } finally {
      setLoadingContext(false)
    }
  }

  // Check if any team member has overlapping time off
  const getOverlappingMembers = () => {
    const requestStart = new Date(request.startDate)
    const requestEnd = new Date(request.endDate)
    // Expand range by a few days to show context
    const contextStart = subDays(requestStart, 3)
    const contextEnd = addDays(requestEnd, 3)
    
    const overlapping: { user: TeamMemberSchedule; dates: { date: Date; type: string }[] }[] = []
    
    teamContext.forEach(member => {
      const memberDates: { date: Date; type: string }[] = []
      
      member.requests.forEach(req => {
        if (req.status !== 'APPROVED') return
        
        const start = new Date(req.startDate)
        const end = new Date(req.endDate)
        const days = eachDayOfInterval({ start, end })
        
        days.forEach(day => {
          // Check if this day is within our context range
          if (isWithinInterval(day, { start: contextStart, end: contextEnd })) {
            const dateStr = format(day, 'yyyy-MM-dd')
            let dayType: 'WFH' | 'TIME_OFF' | 'BOTH' = req.requestType
            if (req.dayBreakdown && req.dayBreakdown[dateStr]) {
              dayType = req.dayBreakdown[dateStr] as 'WFH' | 'TIME_OFF' | 'BOTH'
            }
            memberDates.push({ date: day, type: dayType === 'BOTH' ? 'TIME_OFF' : dayType as 'WFH' | 'TIME_OFF' })
          }
        })
      })
      
      if (memberDates.length > 0) {
        overlapping.push({ user: member, dates: memberDates })
      }
    })
    
    return overlapping
  }

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'WFH': return 'Work From Home'
      case 'TIME_OFF': return 'Time Off'
      case 'BOTH': return 'WFH & Time Off'
      default: return type
    }
  }

  return (
    <div className="rounded-lg border-l-4 border-purple-500 bg-white p-4 shadow-md transition-shadow hover:shadow-lg sm:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
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
        
        {/* Mini Calendar + quick compare action */}
        <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-shrink-0 md:items-end">
          <div className="hidden md:block">
            <MiniCalendar request={request} />
          </div>
          <button
            onClick={() => setShowMasterCalendar(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700 md:justify-start md:py-1.5"
          >
            <span>📅</span> View in Master Calendar
          </button>
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
            <div className="space-y-4">
              {/* Team Context - Who else is out? */}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <span>👥</span> Team Availability Context
                  </h4>
                  <button
                    onClick={() => setShowMasterCalendar(true)}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>📅</span> View Full Team Calendar
                  </button>
                </div>
                
                {loadingContext ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                    Loading team schedules...
                  </div>
                ) : (
                  (() => {
                    const overlapping = getOverlappingMembers()
                    const requestStart = new Date(request.startDate)
                    const requestEnd = new Date(request.endDate)
                    
                    // Check for direct overlaps (same days)
                    const directOverlaps = overlapping.filter(o => 
                      o.dates.some(d => 
                        isWithinInterval(d.date, { start: requestStart, end: requestEnd })
                      )
                    )
                    
                    if (directOverlaps.length === 0 && overlapping.length === 0) {
                      return (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <span>✅</span> No one else is scheduled off during this time!
                        </div>
                      )
                    }
                    
                    return (
                      <div className="space-y-3">
                        {directOverlaps.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">
                              ⚠️ Overlapping with requested dates:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {directOverlaps.map(({ user, dates }) => {
                                const overlapDates = dates.filter(d => 
                                  isWithinInterval(d.date, { start: requestStart, end: requestEnd })
                                )
                                return (
                                  <div key={user.userId} className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-3 py-1.5 rounded-full">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                                      {user.userName[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs font-medium text-red-800 dark:text-red-200">
                                      {user.userName}
                                    </span>
                                    <span className="text-xs text-red-600 dark:text-red-400">
                                      ({overlapDates.length} day{overlapDates.length !== 1 ? 's' : ''})
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        
                        {overlapping.filter(o => !directOverlaps.includes(o)).length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                              📅 Others out around this time (±3 days):
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {overlapping.filter(o => !directOverlaps.includes(o)).map(({ user }) => (
                                <div key={user.userId} className="flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 rounded-full">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                                    {user.userName[0]?.toUpperCase()}
                                  </div>
                                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                                    {user.userName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()
                )}
              </div>
              
              <ApprovalActions
                requestId={request.id}
                forceIsaacCode={forceIsaacCode}
                onSuccess={() => {
                  setShowActions(false)
                  onUpdate()
                }}
                onCancel={() => setShowActions(false)}
              />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
        Submitted {format(new Date(request.createdAt), 'MMM d, yyyy')}
      </p>

      {/* Master Calendar Modal */}
      {showMasterCalendar && (
        <div
          className={`fixed inset-0 z-50 bg-black/50 ${
            compactCalendarModal
              ? 'flex items-end justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-16'
              : 'flex items-center justify-center p-4'
          }`}
          onClick={() => setShowMasterCalendar(false)}
          role="presentation"
        >
          <div
            className={`flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-gray-800 ${
              compactCalendarModal
                ? 'max-h-[min(62vh,32rem)] w-full max-w-lg rounded-t-2xl'
                : 'max-h-[90vh] w-full max-w-6xl rounded-2xl'
            }`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Team calendar"
          >
            {compactCalendarModal && (
              <div className="flex flex-shrink-0 justify-center pt-2 pb-1" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}
            {/* Modal Header */}
            <div
              className={`flex flex-shrink-0 items-start justify-between gap-2 border-b border-gray-200 dark:border-gray-700 ${
                compactCalendarModal ? 'px-3 py-2.5' : 'p-4'
              }`}
            >
              <div className="min-w-0 flex-1">
                <h3
                  className={`font-bold text-gray-800 dark:text-white ${
                    compactCalendarModal ? 'text-base' : 'text-lg'
                  }`}
                >
                  Team Calendar
                </h3>
                <p
                  className={`text-gray-500 dark:text-gray-400 ${
                    compactCalendarModal ? 'mt-0.5 line-clamp-2 text-xs' : 'text-sm'
                  }`}
                >
                  <span className="font-medium text-purple-600 dark:text-purple-400">{request.user?.name}</span>
                  {' · '}
                  {format(new Date(request.startDate), 'MMM d')} – {format(new Date(request.endDate), 'MMM d, yyyy')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterCalendar(false)}
                className="shrink-0 rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="h-5 w-5 text-gray-500 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Highlighted Request Info */}
            <div
              className={`flex-shrink-0 border-b border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20 ${
                compactCalendarModal ? 'px-3 py-2' : 'px-4 py-3'
              }`}
            >
              <div className="flex items-center gap-2 md:gap-3">
                {request.user?.profilePicture ? (
                  <img
                    src={request.user.profilePicture}
                    alt={request.user?.name || 'User'}
                    className={`rounded-full object-cover ${compactCalendarModal ? 'h-7 w-7' : 'h-8 w-8'}`}
                  />
                ) : (
                  <div
                    className={`flex items-center justify-center rounded-full bg-gradient-to-r from-purple-400 to-pink-400 font-bold text-white ${
                      compactCalendarModal ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
                    }`}
                  >
                    {(request.user?.name || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={`font-medium text-purple-800 dark:text-purple-200 ${
                      compactCalendarModal ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    {request.requestType === 'TIME_OFF'
                      ? '🏖️ Time Off'
                      : request.requestType === 'WFH'
                        ? '🏠 WFH'
                        : '📦 Mixed'}
                  </p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 md:text-xs">
                    {format(new Date(request.startDate), 'EEE MMM d')} →{' '}
                    {format(new Date(request.endDate), 'EEE MMM d')}
                  </p>
                </div>
              </div>
            </div>

            {/* Master Calendar */}
            <div className={`min-h-0 flex-1 overflow-auto ${compactCalendarModal ? 'p-2' : 'p-4'}`}>
              <MasterCalendar
                initialMonth={new Date(request.startDate)}
                compact={compactCalendarModal}
                forceIsaacCode={forceIsaacCode}
                pendingRequest={
                  request.status === 'PENDING'
                    ? {
                        userName: request.user?.name || 'Unknown',
                        profilePicture: request.user?.profilePicture,
                        startDate: typeof request.startDate === 'string' ? request.startDate : format(new Date(request.startDate), 'yyyy-MM-dd'),
                        endDate: typeof request.endDate === 'string' ? request.endDate : format(new Date(request.endDate), 'yyyy-MM-dd'),
                        requestType: request.requestType as 'WFH' | 'TIME_OFF' | 'BOTH',
                        dayBreakdown: request.dayBreakdown as Record<string, string> | undefined,
                      }
                    : undefined
                }
              />
            </div>

            {/* Modal Footer */}
            <div
              className={`flex flex-shrink-0 justify-end border-t border-gray-200 dark:border-gray-700 ${
                compactCalendarModal ? 'p-2' : 'p-4'
              }`}
            >
              <button
                type="button"
                onClick={() => setShowMasterCalendar(false)}
                className={`rounded-lg bg-gray-100 font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 ${
                  compactCalendarModal ? 'w-full py-2.5 text-sm' : 'px-4 py-2'
                } transition-colors`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
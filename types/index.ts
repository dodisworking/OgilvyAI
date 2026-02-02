export type RequestType = 'WFH' | 'TIME_OFF' | 'BOTH'
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface Request {
  id: string
  userId: string
  startDate: Date
  endDate: Date
  requestType: RequestType
  title?: string
  reason?: string
  status: RequestStatus
  adminNotes?: string
  dayBreakdown?: Record<string, 'TIME_OFF' | 'WFH'> // Maps date strings (YYYY-MM-DD) to their request type
  createdAt: Date
  updatedAt: Date
  user?: {
    name: string
    email: string
    profilePicture?: string | null
  }
}
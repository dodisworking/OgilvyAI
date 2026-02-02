'use client'

import { useState, useEffect, useRef } from 'react'
import { formatDistanceToNow } from 'date-fns'
import CheckInModal from './CheckInModal'
import PokemonStyleOffice from './PokemonStyleOffice'

interface CheckedInUser {
  id: string
  userId: string
  teamsLink: string
  isCheckedIn: boolean
  checkInTime: string
  x: number | null
  y: number | null
  user: {
    id: string
    name: string
    email: string
    profilePicture: string | null
  }
}

interface MyStatus {
  checkIn: CheckedInUser | null
}

export default function VirtualOffice() {
  const [checkedInUsers, setCheckedInUsers] = useState<CheckedInUser[]>([])
  const [myStatus, setMyStatus] = useState<MyStatus | null>(null)
  const [showCheckInModal, setShowCheckInModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<CheckedInUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef<HTMLDivElement>(null)

  // Office dimensions
  const OFFICE_WIDTH = 1200
  const OFFICE_HEIGHT = 800
  const DESK_SIZE = 80
  const DESK_SPACING = 120

  // Generate desk positions
  const generateDeskPositions = () => {
    const desks: Array<{ x: number; y: number; id: number }> = []
    const cols = Math.floor(OFFICE_WIDTH / DESK_SPACING) - 1
    const rows = Math.floor(OFFICE_HEIGHT / DESK_SPACING) - 1
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        desks.push({
          x: 100 + col * DESK_SPACING,
          y: 100 + row * DESK_SPACING,
          id: row * cols + col,
        })
      }
    }
    return desks
  }

  const deskPositions = generateDeskPositions()

  useEffect(() => {
    fetchMyStatus()
    fetchCheckedInUsers()
    
    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      fetchCheckedInUsers()
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const fetchMyStatus = async () => {
    try {
      const response = await fetch('/api/virtual-office/my-status', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setMyStatus(data)
        if (!data.checkIn || !data.checkIn.isCheckedIn) {
          setShowCheckInModal(true)
        }
      }
    } catch (error) {
      console.error('Failed to fetch my status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCheckedInUsers = async () => {
    try {
      const response = await fetch('/api/virtual-office/checked-in', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setCheckedInUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch checked-in users:', error)
    }
  }

  const handleCheckIn = (teamsLink: string) => {
    setShowCheckInModal(false)
    fetchMyStatus()
    fetchCheckedInUsers()
  }

  const handleCheckOut = async () => {
    try {
      const response = await fetch('/api/virtual-office/checkin', {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.ok) {
        setMyStatus({ checkIn: null })
        fetchCheckedInUsers()
      }
    } catch (error) {
      console.error('Failed to check out:', error)
    }
  }

  const handleAvatarClick = (user: CheckedInUser) => {
    setSelectedUser(user)
  }

  const handleCallUser = (user: CheckedInUser) => {
    if (user.teamsLink) {
      window.open(user.teamsLink, '_blank')
    }
    setSelectedUser(null)
  }

  const handleMoveAvatar = async (x: number, y: number) => {
    try {
      await fetch('/api/virtual-office/position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ x, y }),
      })
      fetchMyStatus()
    } catch (error) {
      console.error('Failed to update position:', error)
    }
  }

  const getAvatarPosition = (user: CheckedInUser) => {
    // Use saved position or assign to a desk
    if (user.x !== null && user.y !== null) {
      return { x: user.x, y: user.y }
    }
    
    // Assign to a desk based on user index
    const deskIndex = checkedInUsers.indexOf(user) % deskPositions.length
    return deskPositions[deskIndex]
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // Use Pokemon-style office instead
  return <PokemonStyleOffice />
}

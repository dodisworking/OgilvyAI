'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import PixelSprite from './PixelSprite'
import CustomAvatarSprite from './CustomAvatarSprite'
import AvatarMaker from './AvatarMaker'
import PixelOfficeTile from './PixelOfficeTile'

interface OfficeUser {
  id: string
  userId: string
  teamsLink?: string
  x: number | null
  y: number | null
  direction?: 'up' | 'down' | 'left' | 'right'
  user: {
    id: string
    name: string
    email: string
    profilePicture: string | null
    avatarData?: any
  }
}

// Simple constants
const TILE_SIZE = 32
const GRID_COLS = 30
const GRID_ROWS = 20
const WORLD_WIDTH = TILE_SIZE * GRID_COLS
const WORLD_HEIGHT = TILE_SIZE * GRID_ROWS
const MOVE_SPEED_MS = 600

type TileType = 'floor' | 'wall' | 'desk' | 'chair' | 'plant' | 'door' | 'couch'

const DESK_POSITIONS = [
  { x: 5, y: 4 }, { x: 8, y: 4 }, { x: 11, y: 4 },
  { x: 5, y: 7 }, { x: 8, y: 7 }, { x: 11, y: 7 },
  { x: 5, y: 10 }, { x: 8, y: 10 }, { x: 11, y: 10 },
  { x: 18, y: 6 }, { x: 21, y: 6 },
  { x: 18, y: 9 }, { x: 21, y: 9 },
]

const COUCH_POSITIONS = [
  { x: 15, y: 4 }, { x: 16, y: 4 },
  { x: 15, y: 12 }, { x: 16, y: 12 },
  { x: 24, y: 8 }, { x: 24, y: 9 },
]

const PLANT_POSITIONS = [
  { x: 2, y: 2 }, { x: 27, y: 2 },
  { x: 2, y: 17 }, { x: 27, y: 17 },
  { x: 14, y: 2 }, { x: 15, y: 2 },
  { x: 14, y: 17 }, { x: 15, y: 17 },
  { x: 24, y: 2 }, { x: 25, y: 2 },
]

const getOfficeTile = (x: number, y: number): TileType => {
  if (x === 0 || x === GRID_COLS - 1 || y === 0 || y === GRID_ROWS - 1) {
    if ((x === 0 && y === 10) || (x === GRID_COLS - 1 && y === 10)) {
      return 'door'
    }
    return 'wall'
  }
  if (DESK_POSITIONS.some(desk => desk.x === x && desk.y === y)) return 'desk'
  if (COUCH_POSITIONS.some(couch => couch.x === x && couch.y === y)) return 'couch'
  if (DESK_POSITIONS.some(desk => desk.x === x - 1 && desk.y === y)) return 'chair'
  if (PLANT_POSITIONS.some(plant => plant.x === x && plant.y === y)) return 'plant'
  return 'floor'
}

const isValidPosition = (x: number, y: number): boolean => {
  if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false
  return getOfficeTile(x, y) === 'floor'
}

const gridToPixel = (x: number, y: number) => ({
  x: x * TILE_SIZE,
  y: y * TILE_SIZE,
})

const pixelToGrid = (px: number, py: number) => ({
  x: Math.floor(px / TILE_SIZE),
  y: Math.floor(py / TILE_SIZE),
})

export default function PokemonStyleOffice() {
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([])
  const [showAvatarMaker, setShowAvatarMaker] = useState(false)
  const [selectedUser, setSelectedUser] = useState<OfficeUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [myAvatarData, setMyAvatarData] = useState<any>(null)
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [isWalkMode, setIsWalkMode] = useState(true)
  const [myPosition, setMyPosition] = useState({ x: 5, y: 5 })
  const [myDirection, setMyDirection] = useState<'up' | 'down' | 'left' | 'right'>('down')
  const [walkingFrame, setWalkingFrame] = useState(0)
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 })
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const keysPressedRef = useRef<Set<string>>(new Set())
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Simple move function
  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isWalkMode || !myAvatarData) return

    setMyPosition(prev => {
      let newX = prev.x
      let newY = prev.y

      switch (direction) {
        case 'up': newY = Math.max(0, prev.y - 1); break
        case 'down': newY = Math.min(GRID_ROWS - 1, prev.y + 1); break
        case 'left': newX = Math.max(0, prev.x - 1); break
        case 'right': newX = Math.min(GRID_COLS - 1, prev.x + 1); break
      }

      if (!isValidPosition(newX, newY) || (newX === prev.x && newY === prev.y)) {
        return prev
      }

      setMyDirection(direction)
      
      // Update camera
      const pixelPos = gridToPixel(newX, newY)
      const viewportWidth = canvasRef.current?.clientWidth || 960
      const viewportHeight = canvasRef.current?.clientHeight || 600
      setCameraOffset({
        x: viewportWidth / 2 - pixelPos.x - TILE_SIZE / 2,
        y: viewportHeight / 2 - pixelPos.y - TILE_SIZE / 2,
      })

      // Debounced save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        fetch('/api/virtual-office/position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ x: pixelPos.x, y: pixelPos.y, direction }),
        }).catch(() => {})
      }, 500)

      return { x: newX, y: newY }
    })
  }, [isWalkMode, myAvatarData])

  // Handle continuous movement
  useEffect(() => {
    if (!isWalkMode || !myAvatarData) {
      if (moveTimerRef.current) {
        clearTimeout(moveTimerRef.current)
        moveTimerRef.current = null
      }
      return
    }

    const keys = keysPressedRef.current
    if (keys.size === 0) return

    const directions: ('up' | 'down' | 'left' | 'right')[] = []
    if (keys.has('w') || keys.has('ArrowUp')) directions.push('up')
    if (keys.has('s') || keys.has('ArrowDown')) directions.push('down')
    if (keys.has('a') || keys.has('ArrowLeft')) directions.push('left')
    if (keys.has('d') || keys.has('ArrowRight')) directions.push('right')

    if (directions.length > 0) {
      move(directions[0])
      moveTimerRef.current = setTimeout(() => {
        moveTimerRef.current = null
      }, MOVE_SPEED_MS)
    }
  }, [isWalkMode, myAvatarData, myPosition, move])

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isWalkMode || !myAvatarData) return
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
        keysPressedRef.current.add(key)
        move(key === 'w' || key === 'arrowup' ? 'up' :
             key === 's' || key === 'arrowdown' ? 'down' :
             key === 'a' || key === 'arrowleft' ? 'left' : 'right')
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressedRef.current.delete(key)
      keysPressedRef.current.delete(key === 'arrowup' ? 'w' :
                                     key === 'arrowdown' ? 's' :
                                     key === 'arrowleft' ? 'a' :
                                     key === 'arrowright' ? 'd' : '')
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isWalkMode, myAvatarData, move])

  // Walking animation
  useEffect(() => {
    if (!isWalkMode || !myAvatarData || keysPressedRef.current.size === 0) {
      setWalkingFrame(0)
      return
    }
    const interval = setInterval(() => {
      setWalkingFrame(prev => prev === 0 ? 1 : 0)
    }, 200)
    return () => clearInterval(interval)
  }, [isWalkMode, myAvatarData, keysPressedRef.current.size])

  // Directional buttons
  const handleButtonPress = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!isWalkMode || !myAvatarData) return
    move(direction)
    const key = direction === 'up' ? 'w' : direction === 'down' ? 's' : direction === 'left' ? 'a' : 'd'
    keysPressedRef.current.add(key)
  }, [isWalkMode, myAvatarData, move])

  const handleButtonRelease = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const key = direction === 'up' ? 'w' : direction === 'down' ? 's' : direction === 'left' ? 'a' : 'd'
    keysPressedRef.current.delete(key)
  }, [])

  // Fetch data - avatar first, then office
  useEffect(() => {
    const fetchData = async () => {
      try {
        const userRes = await fetch('/api/auth/me', { credentials: 'include' })
        if (userRes.ok) {
          const userData = await userRes.json()
          const rawAvatar = userData.user?.avatarData ?? userData.avatarData
          const hasAvatar = rawAvatar != null && typeof rawAvatar === 'object' && Object.keys(rawAvatar).length > 0
          setMyAvatarData(hasAvatar ? rawAvatar : null)
          setMyUserId(userData.user?.id || userData.id)
          if (!hasAvatar) {
            setShowAvatarMaker(true)
          }
        } else {
          setMyAvatarData(null)
        }

        const usersRes = await fetch('/api/virtual-office/checked-in', { credentials: 'include' })
        if (usersRes.ok) {
          const users = await usersRes.json()
          setOfficeUsers(Array.isArray(users) ? users : [])
        } else {
          setOfficeUsers([])
        }
      } catch (error) {
        console.error('Failed to fetch:', error)
        setOfficeUsers([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(() => {
      fetch('/api/virtual-office/checked-in', { credentials: 'include' })
        .then(r => r.ok ? r.json() : [])
        .then(data => setOfficeUsers(Array.isArray(data) ? data : []))
        .catch(() => setOfficeUsers([]))
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleSaveAvatar = async (avatarData: any) => {
    try {
      await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(avatarData),
      })
      setMyAvatarData(avatarData)
      setShowAvatarMaker(false)
    } catch (error) {
      console.error('Failed to save avatar:', error)
    }
  }

  const handleAvatarClick = (user: OfficeUser) => {
    setSelectedUser(user)
    const pixelPos = gridToPixel(myPosition.x, myPosition.y)
    fetch('/api/virtual-office/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ x: pixelPos.x, y: pixelPos.y, direction: myDirection }),
    }).catch(() => {})
  }

  const handleCallUser = (user: OfficeUser) => {
    const pixelPos = gridToPixel(myPosition.x, myPosition.y)
    fetch('/api/virtual-office/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ x: pixelPos.x, y: pixelPos.y, direction: myDirection }),
    }).catch(() => {})
    if (user.teamsLink) {
      window.open(user.teamsLink, '_blank')
    }
    setSelectedUser(null)
  }

  const getUserGridPosition = (user: OfficeUser) => {
    if (user.x !== null && user.y !== null) {
      return pixelToGrid(user.x, user.y)
    }
    return { x: 5, y: 5 }
  }

  const PixelCharacter = ({ 
    direction, 
    isMe = false, 
    avatarData: userAvatarData,
    name,
    walkingFrame = 0
  }: { 
    direction: 'up' | 'down' | 'left' | 'right'
    isMe?: boolean
    avatarData?: any
    name?: string
    walkingFrame?: number
  }) => {
    if (userAvatarData || (isMe && myAvatarData)) {
      return (
        <CustomAvatarSprite 
          direction={direction} 
          avatarData={userAvatarData || myAvatarData}
          size={4}
          walkingFrame={walkingFrame}
        />
      )
    }
    
    const getColor = () => {
      if (isMe) return '#a855f7'
      if (name) {
        let hash = 0
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash)
        }
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
        return colors[Math.abs(hash) % colors.length]
      }
      return '#3b82f6'
    }
    
    return <PixelSprite direction={direction} color={getColor()} size={4} />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  // No avatar yet: show only avatar step first
  if (!myAvatarData) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <span>🏢</span> Virtual Office
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Create your avatar to enter the office
          </p>
        </div>
        <AvatarMaker
          onClose={() => {}}
          onSave={handleSaveAvatar}
          existingAvatar={null}
        />
      </div>
    )
  }

  const myPixelPos = gridToPixel(myPosition.x, myPosition.y)

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <span>🏢</span> Virtual Office
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {officeUsers.length} {officeUsers.length === 1 ? 'person' : 'people'} in the office
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isWalkMode ? 'Walking ON: use WASD / Arrow Keys' : 'Click "Walk around" to enable movement'}
          </p>
        </div>
        <div className="flex gap-2">
            <>
              <button
                onClick={() => setIsWalkMode(v => !v)}
                className={`px-4 py-2 rounded-lg border font-medium text-sm transition-all ${
                  isWalkMode
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isWalkMode ? '🟢 Walking' : '🎮 Walk around'}
              </button>
              <button
                onClick={() => setShowAvatarMaker(true)}
                className="px-4 py-2 rounded-lg border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium text-sm"
              >
                🎨 Edit Avatar
              </button>
            </>
        </div>
      </div>

      {/* Office World */}
      <div className="relative bg-gray-900 rounded-xl border-4 border-gray-700 overflow-hidden" style={{ imageRendering: 'pixelated' as any }}>
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: '100%',
              height: '600px',
              overflow: 'hidden',
              backgroundColor: '#0f380f',
            }}
          >
            <div
              className="absolute"
              style={{
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
                transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px)`,
              }}
            >
              {/* Tiles */}
              <div className="absolute inset-0">
                {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, i) => {
                  const x = i % GRID_COLS
                  const y = Math.floor(i / GRID_COLS)
                  return (
                    <PixelOfficeTile
                      key={i}
                      type={getOfficeTile(x, y)}
                      x={x}
                      y={y}
                      tileSize={TILE_SIZE}
                    />
                  )
                })}
              </div>

              {/* Other Users */}
              {Array.isArray(officeUsers) && officeUsers
                .filter(user => user && user.userId !== myUserId)
                .map((user) => {
                  const gridPos = getUserGridPosition(user)
                  const pixelPos = gridToPixel(gridPos.x, gridPos.y)
                  return (
                    <div
                      key={user.id}
                      className="absolute cursor-pointer group z-10"
                      style={{
                        left: pixelPos.x + TILE_SIZE / 2,
                        top: pixelPos.y + TILE_SIZE / 2,
                        transform: 'translate(-50%, -100%)',
                        imageRendering: 'pixelated' as any,
                      }}
                      onClick={() => handleAvatarClick(user)}
                    >
                      <PixelCharacter
                        direction={user.direction || 'down'}
                        avatarData={(user.user as any).avatarData}
                        name={user.user.name}
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-900" />
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="bg-purple-600 text-white text-xs rounded py-0.5 px-1 whitespace-nowrap font-semibold border-2 border-purple-900">
                          {user.user.name}
                        </div>
                      </div>
                    </div>
                  )
                })}

              {/* My Avatar */}
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: myPixelPos.x + TILE_SIZE / 2,
                  top: myPixelPos.y + TILE_SIZE / 2,
                  transform: 'translate(-50%, -100%)',
                  imageRendering: 'pixelated' as any,
                }}
              >
                <PixelCharacter
                  direction={myDirection}
                  isMe={true}
                  avatarData={myAvatarData}
                  name="You"
                  walkingFrame={walkingFrame}
                />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-900" />
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1">
                  <div className="bg-purple-600 text-white text-xs rounded py-0.5 px-1 whitespace-nowrap font-semibold border-2 border-purple-900">
                    You
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Directional Controls */}
      {isWalkMode && (
        <div className="mt-4 flex justify-center" style={{ touchAction: 'pan-y' }}>
          <div className="relative w-32 h-32" style={{ touchAction: 'none' }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleButtonPress('up') }}
              onMouseUp={() => handleButtonRelease('up')}
              onMouseLeave={() => handleButtonRelease('up')}
              onTouchStart={(e) => { e.stopPropagation(); handleButtonPress('up') }}
              onTouchEnd={(e) => { e.stopPropagation(); handleButtonRelease('up') }}
              className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-lg bg-gradient-to-b from-purple-500 to-purple-600 text-white font-bold text-xl shadow-lg border-2 border-purple-700 flex items-center justify-center"
              style={{ touchAction: 'pan-y' }}
            >
              ↑
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleButtonPress('left') }}
              onMouseUp={() => handleButtonRelease('left')}
              onMouseLeave={() => handleButtonRelease('left')}
              onTouchStart={(e) => { e.stopPropagation(); handleButtonPress('left') }}
              onTouchEnd={(e) => { e.stopPropagation(); handleButtonRelease('left') }}
              className="absolute left-0 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-lg bg-gradient-to-b from-purple-500 to-purple-600 text-white font-bold text-xl shadow-lg border-2 border-purple-700 flex items-center justify-center"
              style={{ touchAction: 'pan-y' }}
            >
              ←
            </button>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-lg bg-gray-700 border-2 border-gray-600 flex items-center justify-center opacity-50">
              🎮
            </div>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleButtonPress('right') }}
              onMouseUp={() => handleButtonRelease('right')}
              onMouseLeave={() => handleButtonRelease('right')}
              onTouchStart={(e) => { e.stopPropagation(); handleButtonPress('right') }}
              onTouchEnd={(e) => { e.stopPropagation(); handleButtonRelease('right') }}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-lg bg-gradient-to-b from-purple-500 to-purple-600 text-white font-bold text-xl shadow-lg border-2 border-purple-700 flex items-center justify-center"
              style={{ touchAction: 'pan-y' }}
            >
              →
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleButtonPress('down') }}
              onMouseUp={() => handleButtonRelease('down')}
              onMouseLeave={() => handleButtonRelease('down')}
              onTouchStart={(e) => { e.stopPropagation(); handleButtonPress('down') }}
              onTouchEnd={(e) => { e.stopPropagation(); handleButtonRelease('down') }}
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-lg bg-gradient-to-b from-purple-500 to-purple-600 text-white font-bold text-xl shadow-lg border-2 border-purple-700 flex items-center justify-center"
              style={{ touchAction: 'pan-y' }}
            >
              ↓
            </button>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.isArray(officeUsers) && officeUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-purple-200 dark:border-purple-800 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleAvatarClick(user)}
            >
              <div className="flex items-center gap-3">
                {user.user.profilePicture ? (
                  <img
                    src={user.user.profilePicture}
                    alt={user.user.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-purple-300"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-200 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold">
                    {user.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{user.user.name}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* Modals */}
      {showAvatarMaker && (
        <AvatarMaker
          onClose={() => {
            if (myAvatarData) {
              setShowAvatarMaker(false)
            }
          }}
          onSave={handleSaveAvatar}
          existingAvatar={myAvatarData}
        />
      )}

      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedUser(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{selectedUser.user.name}</h3>
            {selectedUser.teamsLink && (
              <button
                onClick={() => handleCallUser(selectedUser)}
                className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
              >
                📞 Call on Teams
              </button>
            )}
            <button
              onClick={() => setSelectedUser(null)}
              className="w-full mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

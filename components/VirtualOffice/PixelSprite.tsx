'use client'

// Game Boy Pokemon-style sprite data
// Each number represents a color: 0=transparent, 1=dark, 2=medium, 3=light

const SPRITE_DOWN = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 3, 3, 3, 3, 1, 0],
  [0, 1, 3, 2, 2, 3, 1, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [1, 2, 2, 1, 1, 2, 2, 1],
  [1, 1, 1, 0, 0, 1, 1, 1],
]

const SPRITE_UP = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 1, 3, 3, 3, 3, 1, 0],
  [0, 1, 3, 2, 2, 3, 1, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 2, 2, 1, 0, 0],
  [0, 1, 1, 2, 2, 1, 1, 0],
  [1, 2, 2, 1, 1, 2, 2, 1],
  [1, 1, 1, 0, 0, 1, 1, 1],
]

const SPRITE_LEFT = [
  [0, 0, 0, 1, 1, 1, 0, 0],
  [0, 0, 1, 3, 3, 3, 1, 0],
  [0, 1, 3, 2, 2, 3, 1, 0],
  [1, 1, 2, 2, 2, 2, 1, 0],
  [0, 1, 2, 2, 2, 1, 0, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [1, 2, 2, 1, 1, 2, 2, 1],
  [1, 1, 1, 0, 0, 1, 1, 1],
]

const SPRITE_RIGHT = [
  [0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 3, 3, 3, 1, 0, 0],
  [0, 1, 3, 2, 2, 3, 1, 0],
  [0, 1, 2, 2, 2, 2, 1, 1],
  [0, 0, 1, 2, 2, 2, 1, 0],
  [0, 1, 2, 1, 1, 2, 1, 0],
  [1, 2, 2, 1, 1, 2, 2, 1],
  [1, 1, 1, 0, 0, 1, 1, 1],
]

interface PixelSpriteProps {
  direction: 'up' | 'down' | 'left' | 'right'
  color?: string // Base color for the sprite
  size?: number // Pixel size multiplier
}

export default function PixelSprite({ 
  direction, 
  color = '#a855f7', // Default purple
  size = 4 // 4px per pixel = 32px total sprite
}: PixelSpriteProps) {
  // Get sprite data based on direction
  const getSpriteData = () => {
    switch (direction) {
      case 'up': return SPRITE_UP
      case 'down': return SPRITE_DOWN
      case 'left': return SPRITE_LEFT
      case 'right': return SPRITE_RIGHT
      default: return SPRITE_DOWN
    }
  }

  const spriteData = getSpriteData()
  const spriteWidth = spriteData[0].length
  const spriteHeight = spriteData.length

  // Color palette (Game Boy style)
  const getColor = (value: number) => {
    if (value === 0) return 'transparent'
    
    // Convert hex color to RGB for tinting
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    switch (value) {
      case 1: // Darkest (outline)
        return `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`
      case 2: // Medium (shadow)
        return `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`
      case 3: // Light (highlight)
        return color
      default:
        return 'transparent'
    }
  }

  return (
    <div
      style={{
        width: spriteWidth * size,
        height: spriteHeight * size,
        position: 'relative',
        imageRendering: 'pixelated',
        imageRendering: '-moz-crisp-edges',
        imageRendering: 'crisp-edges',
      }}
    >
      {spriteData.map((row, rowIndex) =>
        row.map((pixel, colIndex) => {
          if (pixel === 0) return null // Skip transparent pixels
          
          const pixelColor = getColor(pixel)
          
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                position: 'absolute',
                left: colIndex * size,
                top: rowIndex * size,
                width: size,
                height: size,
                backgroundColor: pixelColor,
                imageRendering: 'pixelated',
              }}
            />
          )
        })
      )}
    </div>
  )
}

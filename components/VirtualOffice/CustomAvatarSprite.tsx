'use client'

interface AvatarData {
  gender?: 'male' | 'female'
  skinColor: string
  hairColor: string
  hairStyle: 'short' | 'medium' | 'long' | 'spiky' | 'mohawk' | 'afro' | 'ponytail' | 'braids' | 'mullet' | 'bald' | 'curly' | 'bob' | 'pigtails' | 'bun' | 'dreadlocks'
  shirtColor: string
  pantsColor: string
  shoesColor: string
}

interface CustomAvatarSpriteProps {
  direction: 'up' | 'down' | 'left' | 'right'
  avatarData: AvatarData
  size?: number
  walkingFrame?: number // 0 or 1 for walking animation
}

export default function CustomAvatarSprite({ 
  direction, 
  avatarData,
  size = 4,
  walkingFrame = 0
}: CustomAvatarSpriteProps) {
  // Generate sprite based on avatar customization and direction
  const generateSprite = () => {
    const sprite = Array(8).fill(null).map(() => Array(8).fill(0))
    const isFemale = avatarData.gender === 'female'
    const isWalking = walkingFrame === 1
    
    // Head (skin color) - same for all directions
    sprite[1][2] = 3 // Top of head
    sprite[1][3] = 3
    sprite[1][4] = 3
    sprite[1][5] = 3
    sprite[2][2] = 3
    sprite[2][3] = 2 // Face
    sprite[2][4] = 2
    sprite[2][5] = 3
    sprite[3][2] = 2
    sprite[3][3] = 1 // Eyes
    sprite[3][4] = 1
    sprite[3][5] = 2
    
    // Hair (based on hair style) - Each style is now distinct and visually clear
    const hairStyle = avatarData.hairStyle || 'short'
    
    if (hairStyle === 'short') {
      // Short - neat, simple short hair on top
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
    } else if (hairStyle === 'medium') {
      // Medium - slightly longer, covers more area
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
      sprite[1][6] = 2
    } else if (hairStyle === 'long') {
      // Long - long hair flowing down the sides
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][6] = 2
      sprite[2][1] = 2
      sprite[2][6] = 2
      sprite[3][1] = 2
      sprite[3][6] = 2
    } else if (hairStyle === 'spiky') {
      // Spiky - multiple sharp spikes pointing up
      sprite[0][1] = 3  // Left spike
      sprite[0][2] = 2
      sprite[0][3] = 3  // Center-left spike
      sprite[0][4] = 3  // Center-right spike
      sprite[0][5] = 2
      sprite[0][6] = 3  // Right spike
      sprite[1][2] = 2  // Base of spikes
      sprite[1][3] = 2
      sprite[1][4] = 2
      sprite[1][5] = 2
    } else if (hairStyle === 'mohawk') {
      // Mohawk - strip of hair down the middle, shaved sides
      sprite[0][3] = 3  // Top of mohawk
      sprite[0][4] = 3
      sprite[1][2] = 2  // Wider at base
      sprite[1][3] = 2
      sprite[1][4] = 2
      sprite[1][5] = 2
      sprite[2][3] = 2  // Extends down
      sprite[2][4] = 2
    } else if (hairStyle === 'afro') {
      // Afro - full, round afro extending outward in all directions
      sprite[0][0] = 2  // Extends to edges
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[0][7] = 2
      sprite[1][0] = 2  // Full width
      sprite[1][1] = 2
      sprite[1][2] = 2
      sprite[1][3] = 2
      sprite[1][4] = 2
      sprite[1][5] = 2
      sprite[1][6] = 2
      sprite[1][7] = 2
      sprite[2][0] = 2  // Extends down sides
      sprite[2][1] = 2
      sprite[2][6] = 2
      sprite[2][7] = 2
    } else if (hairStyle === 'ponytail') {
      // Ponytail - hair pulled back, ponytail hanging down
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][6] = 2
      // Ponytail hanging down the back
      if (direction === 'left') {
        sprite[2][0] = 2
        sprite[3][0] = 2
        sprite[4][0] = 2
      } else if (direction === 'right') {
        sprite[2][7] = 2
        sprite[3][7] = 2
        sprite[4][7] = 2
      } else {
        sprite[1][0] = 2
        sprite[2][0] = 2
        sprite[3][0] = 2
      }
    } else if (hairStyle === 'braids') {
      // Braids - hair in braids hanging down the sides
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][6] = 2
      // Braids hanging down both sides
      sprite[2][0] = 2
      sprite[3][0] = 2
      sprite[4][0] = 2
      sprite[2][7] = 2
      sprite[3][7] = 2
      sprite[4][7] = 2
    } else if (hairStyle === 'mullet') {
      // Mullet - short on top, long in back
      sprite[0][2] = 2  // Short on top
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
      // Long in back
      sprite[1][6] = 2
      sprite[2][6] = 2
      sprite[3][6] = 2
      sprite[4][6] = 2
    } else if (hairStyle === 'bald') {
      // Bald - no hair, just head
      // Nothing to add
    } else if (hairStyle === 'curly') {
      // Curly - wavy/curly texture, fuller appearance
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][0] = 2  // Curls extend outward
      sprite[1][1] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
      sprite[1][6] = 2
      sprite[1][7] = 2
      sprite[2][1] = 2  // Curls on sides
      sprite[2][6] = 2
    } else if (hairStyle === 'bob') {
      // Bob - short, even-length cut around the head
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][6] = 2
      sprite[2][1] = 2
      sprite[2][6] = 2
      sprite[3][1] = 2
      sprite[3][6] = 2
    } else if (hairStyle === 'pigtails') {
      // Pigtails - two ponytails on the sides
      sprite[0][2] = 2  // Hair on top
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
      // Two pigtails on sides
      sprite[1][0] = 2
      sprite[2][0] = 2
      sprite[3][0] = 2
      sprite[1][7] = 2
      sprite[2][7] = 2
      sprite[3][7] = 2
    } else if (hairStyle === 'bun') {
      // Bun - hair pulled up into a bun on top of head
      sprite[0][1] = 2  // Hair around bun
      sprite[0][2] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][6] = 2
      // Bun itself - circular shape on top
      sprite[0][3] = 3  // Top of bun
      sprite[0][4] = 3
      sprite[1][2] = 3  // Sides of bun
      sprite[1][3] = 3
      sprite[1][4] = 3
      sprite[1][5] = 3
    } else if (hairStyle === 'dreadlocks') {
      // Dreadlocks - long locks hanging down
      sprite[0][1] = 2
      sprite[0][2] = 2
      sprite[0][3] = 2
      sprite[0][4] = 2
      sprite[0][5] = 2
      sprite[0][6] = 2
      sprite[1][1] = 2
      sprite[1][2] = 2
      sprite[1][5] = 2
      sprite[1][6] = 2
      // Locks hanging down
      sprite[2][1] = 2
      sprite[2][6] = 2
      sprite[3][1] = 2
      sprite[3][6] = 2
      sprite[4][1] = 2
      sprite[4][6] = 2
    }
    
    // Body (shirt) - adjust based on direction and gender
    if (direction === 'left') {
      sprite[4][1] = 2
      sprite[4][2] = 3
      sprite[4][3] = 3
      sprite[4][4] = 2
      sprite[5][1] = 3
      sprite[5][2] = 3
      sprite[5][3] = 3
      sprite[5][4] = 3
      // Female: slightly narrower waist
      if (isFemale) {
        sprite[5][2] = 2
        sprite[5][4] = 2
      }
    } else if (direction === 'right') {
      sprite[4][4] = 2
      sprite[4][5] = 3
      sprite[4][6] = 3
      sprite[4][7] = 2
      sprite[5][4] = 3
      sprite[5][5] = 3
      sprite[5][6] = 3
      sprite[5][7] = 3
      // Female: slightly narrower waist
      if (isFemale) {
        sprite[5][5] = 2
        sprite[5][7] = 2
      }
    } else {
      sprite[4][2] = 2
      sprite[4][3] = 3
      sprite[4][4] = 3
      sprite[4][5] = 2
      sprite[5][2] = 3
      sprite[5][3] = 3
      sprite[5][4] = 3
      sprite[5][5] = 3
      // Female: slightly narrower waist and chest indication
      if (isFemale) {
        sprite[4][3] = 2
        sprite[4][5] = 2
        sprite[5][2] = 2
        sprite[5][5] = 2
      }
    }
    
    // Legs (pants for male, dress for female) - walking animation
    if (isFemale) {
      // Dress - wider at bottom
      sprite[5][1] = 3
      sprite[5][6] = 3
      sprite[6][1] = 2
      sprite[6][2] = 3
      sprite[6][3] = 3
      sprite[6][4] = 3
      sprite[6][5] = 3
      sprite[6][6] = 2
      // Walking: shift legs to show stepping
      if (isWalking) {
        sprite[7][1] = 1  // Left foot forward
        sprite[7][2] = 1
        sprite[7][5] = 1  // Right foot back
        sprite[7][6] = 1
      } else {
        sprite[7][2] = 1
        sprite[7][3] = 1
        sprite[7][4] = 1
        sprite[7][5] = 1
      }
    } else {
      // Pants for male - walking animation shifts legs
      sprite[6][2] = 2
      sprite[6][3] = 2
      sprite[6][4] = 2
      sprite[6][5] = 2
      // Walking: alternate leg positions (one forward, one back)
      if (isWalking) {
        sprite[7][1] = 1  // Left foot forward
        sprite[7][2] = 1
        sprite[7][5] = 1  // Right foot back
        sprite[7][6] = 1
      } else {
        sprite[7][2] = 1
        sprite[7][3] = 1
        sprite[7][4] = 1
        sprite[7][5] = 1
      }
    }
    
    // Shoes - walking animation shows feet in different positions
    // (already handled above in legs section)
    
    return sprite
  }

  const spriteData = generateSprite()

  // Get color based on body part
  const getColor = (value: number, row: number, col: number) => {
    if (value === 0) return 'transparent'
    
    // Determine which part of body
    if (row <= 3) {
      // Head area - check if it's hair or skin
      // Hair detection: row 0 is always hair (unless bald), and side/extension positions are hair
      const isHair = avatarData.hairStyle !== 'bald' && (
        row === 0 || // Top row is always hair
        (row === 1 && (col <= 1 || col >= 6)) || // Side hair row 1
        (row === 2 && (col <= 0 || col >= 7)) || // Side hair row 2  
        (row === 3 && (col <= 0 || col >= 7)) // Side hair row 3
      )
      
      if (isHair) {
        return avatarData.hairColor // Hair
      }
      return avatarData.skinColor // Skin
    } else if (row <= 5) {
      return avatarData.shirtColor // Shirt
    } else if (row === 6) {
      // For females, row 6 is part of the dress (use shirt color)
      // For males, row 6 is pants
      if (avatarData.gender === 'female') {
        return avatarData.shirtColor // Dress uses shirt color
      }
      return avatarData.pantsColor // Pants for male
    } else {
      return avatarData.shoesColor // Shoes
    }
  }

  // Convert color to RGB for shading
  const applyShade = (color: string, shade: number) => {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    if (shade === 1) {
      return `rgb(${Math.max(0, r - 100)}, ${Math.max(0, g - 100)}, ${Math.max(0, b - 100)})`
    } else if (shade === 2) {
      return `rgb(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)})`
    } else {
      return color
    }
  }

  return (
    <div
      style={{
        width: 8 * size,
        height: 8 * size,
        position: 'relative',
        imageRendering: 'pixelated',
      }}
    >
      {spriteData.map((row, rowIndex) =>
        row.map((pixel, colIndex) => {
          if (pixel === 0) return null
          
          const baseColor = getColor(pixel, rowIndex, colIndex)
          const finalColor = applyShade(baseColor, pixel)
          
          return (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                position: 'absolute',
                left: colIndex * size,
                top: rowIndex * size,
                width: size,
                height: size,
                backgroundColor: finalColor,
                imageRendering: 'pixelated',
              }}
            />
          )
        })
      )}
    </div>
  )
}

'use client'

// Game Boy style office tiles - renders individual pixelated tiles
interface PixelOfficeTileProps {
  type: 'floor' | 'wall' | 'desk' | 'chair' | 'plant' | 'door' | 'couch'
  x: number
  y: number
  tileSize: number
}

export default function PixelOfficeTile({ type, x, y, tileSize }: PixelOfficeTileProps) {
  // Game Boy Color palette (4 shades per tile type - authentic retro look)
  const colors = {
    floor: ['#9bbc0f', '#8bac0f', '#306230', '#0f380f'], // Light green to dark green (carpet)
    wall: ['#c4cfa1', '#8b956d', '#4d533c', '#1e2321'], // Light gray to dark gray (walls)
    desk: ['#d0d0a0', '#a0a070', '#707050', '#505030'], // Beige/brown (wooden desks)
    chair: ['#f0c070', '#d0a050', '#a08030', '#705020'], // Yellow-brown (chairs)
    plant: ['#60c060', '#40a040', '#208020', '#106010'], // Green (plants)
    door: ['#a08060', '#806040', '#604020', '#402010'], // Brown (wooden doors)
    couch: ['#d4a574', '#b8956a', '#8b7355', '#6b5d4a'], // Brown/beige (couches)
  }

  const tileColors = colors[type]
  
  // Calculate pixel size (8x8 pixel grid per tile)
  const pixelSize = tileSize / 8

  // Render pixelated tile based on type
  const renderTile = () => {
    const pixels: Array<{ x: number; y: number; color: string }> = []
    const pixelSize = tileSize / 16 // 16x16 pixel grid per tile for more detail
    const gridSize = 16 // 16x16 grid

    if (type === 'floor') {
      // Floor pattern - checkered carpet
      for (let py = 0; py < gridSize; py++) {
        for (let px = 0; px < gridSize; px++) {
          const isDark = (px + py) % 2 === 0
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: isDark ? tileColors[1] : tileColors[0],
          })
        }
      }
    } else if (type === 'wall') {
      // Wall - vertical lines pattern
      for (let py = 0; py < gridSize; py++) {
        for (let px = 0; px < gridSize; px++) {
          const isEdge = px === 0 || px === gridSize - 1 || py === 0 || py === gridSize - 1
          const shade = isEdge ? 3 : (px % 2 === 0 ? 1 : 0)
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[shade],
          })
        }
      }
    } else if (type === 'desk') {
      // Desk - top-down view with more detail
      // Desk top (center)
      for (let py = 4; py < 12; py++) {
        for (let px = 2; px < 14; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[0],
          })
        }
      }
      // Desk edges
      for (let py = 4; py < 12; py++) {
        pixels.push({ x: 0, y: py * pixelSize, color: tileColors[2] })
        pixels.push({ x: (gridSize - 1) * pixelSize, y: py * pixelSize, color: tileColors[2] })
      }
      for (let px = 2; px < 14; px++) {
        pixels.push({ x: px * pixelSize, y: 4 * pixelSize, color: tileColors[2] })
        pixels.push({ x: px * pixelSize, y: 11 * pixelSize, color: tileColors[2] })
      }
      // Desk legs (corners)
      pixels.push({ x: 0, y: 0, color: tileColors[3] })
      pixels.push({ x: (gridSize - 1) * pixelSize, y: 0, color: tileColors[3] })
      pixels.push({ x: 0, y: (gridSize - 1) * pixelSize, color: tileColors[3] })
      pixels.push({ x: (gridSize - 1) * pixelSize, y: (gridSize - 1) * pixelSize, color: tileColors[3] })
    } else if (type === 'chair') {
      // Chair - simple square
      for (let py = 6; py < 12; py++) {
        for (let px = 4; px < 12; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[1],
          })
        }
      }
      // Chair back
      for (let py = 2; py < 6; py++) {
        for (let px = 6; px < 10; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[2],
          })
        }
      }
    } else if (type === 'plant') {
      // Plant pot
      for (let py = 8; py < gridSize; py++) {
        for (let px = 4; px < 12; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[3],
          })
        }
      }
      // Plant leaves (more detailed)
      for (let py = 0; py < 8; py++) {
        for (let px = 2; px < 14; px++) {
          if ((px === 2 || px === 13) && py < 4) continue
          if ((px === 3 || px === 12) && py < 2) continue
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[py < 4 ? 0 : 1],
          })
        }
      }
    } else if (type === 'door') {
      // Door - vertical rectangle
      for (let py = 0; py < gridSize; py++) {
        for (let px = 4; px < 12; px++) {
          const isFrame = py === 0 || py === gridSize - 1 || px === 4 || px === 11
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: isFrame ? tileColors[3] : tileColors[1],
          })
        }
      }
      // Door handle
      pixels.push({ x: 10 * pixelSize, y: 8 * pixelSize, color: tileColors[0] })
    } else if (type === 'couch') {
      // Couch - comfy seating
      // Couch seat
      for (let py = 8; py < gridSize; py++) {
        for (let px = 2; px < 14; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[1],
          })
        }
      }
      // Couch back
      for (let py = 4; py < 8; py++) {
        for (let px = 2; px < 14; px++) {
          pixels.push({
            x: px * pixelSize,
            y: py * pixelSize,
            color: tileColors[2],
          })
        }
      }
      // Couch arms
      for (let py = 4; py < gridSize; py++) {
        pixels.push({ x: 0, y: py * pixelSize, color: tileColors[3] })
        pixels.push({ x: (gridSize - 1) * pixelSize, y: py * pixelSize, color: tileColors[3] })
      }
      // Couch cushions (decorative)
      for (let py = 9; py < 12; py++) {
        for (let px = 4; px < 6; px++) {
          pixels.push({ x: px * pixelSize, y: py * pixelSize, color: tileColors[0] })
        }
        for (let px = 10; px < 12; px++) {
          pixels.push({ x: px * pixelSize, y: py * pixelSize, color: tileColors[0] })
        }
      }
    }

    return pixels
  }

  const pixels = renderTile()

  return (
    <div
      className="absolute"
      style={{
        left: x * tileSize,
        top: y * tileSize,
        width: tileSize,
        height: tileSize,
        imageRendering: 'pixelated' as any,
      }}
    >
      {pixels.map((pixel, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: pixel.x,
            top: pixel.y,
            width: pixelSize,
            height: pixelSize,
            backgroundColor: pixel.color,
            imageRendering: 'pixelated' as any,
          }}
        />
      ))}
    </div>
  )
}

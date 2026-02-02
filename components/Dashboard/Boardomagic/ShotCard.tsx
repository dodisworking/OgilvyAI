'use client'

interface ShotCardProps {
  shotNumber: number
  sceneDescription: string
  motionDescription?: string
  duration: number
  characterCount: number
  onClick?: () => void
}

export default function ShotCard({
  shotNumber,
  sceneDescription,
  motionDescription,
  duration,
  characterCount,
  onClick,
}: ShotCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-4 border-2
        ${onClick ? 'cursor-pointer hover:border-purple-500 transition-all' : ''}
        border-gray-200 dark:border-gray-700
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-bold text-lg text-purple-600 dark:text-purple-400">
          Shot {shotNumber}
        </h4>
        <span className="text-sm text-gray-500">{duration}s</span>
      </div>
      <p className="text-gray-700 dark:text-gray-300 mb-2">{sceneDescription}</p>
      {motionDescription && (
        <p className="text-sm text-gray-500 italic">Motion: {motionDescription}</p>
      )}
      <div className="mt-2 text-xs text-gray-400">
        {characterCount} {characterCount === 1 ? 'character' : 'characters'}
      </div>
    </div>
  )
}

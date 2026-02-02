'use client'

interface TempoMarker {
  time: number // Time in seconds
  emotion: string
  tempo: string
}

interface TimelineMarkerProps {
  marker: TempoMarker
  totalDuration: number
  onEdit?: (marker: TempoMarker) => void
  onDelete?: () => void
}

export default function TimelineMarker({
  marker,
  totalDuration,
  onEdit,
  onDelete,
}: TimelineMarkerProps) {
  const positionPercent = (marker.time / totalDuration) * 100

  return (
    <div
      className="absolute top-0 transform -translate-x-1/2"
      style={{ left: `${positionPercent}%` }}
    >
      <div className="relative">
        <div className="w-4 h-4 bg-purple-600 rounded-full border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform" />
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
          <div className="font-bold">{marker.emotion}</div>
          <div className="text-gray-300">{marker.tempo}</div>
          <div className="text-gray-400 text-[10px]">{marker.time}s</div>
          {(onEdit || onDelete) && (
            <div className="mt-1 flex gap-1">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(marker)
                  }}
                  className="text-[10px] bg-blue-500 hover:bg-blue-600 px-1 rounded"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="text-[10px] bg-red-500 hover:bg-red-600 px-1 rounded"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

interface MusicReviewStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function MusicReviewStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: MusicReviewStepProps) {
  const markers = (project?.music?.tempoMarkers as any[]) || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 10: Review Music</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Review your music description and tempo markers
        </p>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-bold mb-2">Music Description</h3>
        <p className="text-gray-700 dark:text-gray-300">
          {project?.music?.description || 'No music description'}
        </p>
      </div>

      {markers.length > 0 && (
        <div>
          <h3 className="font-bold mb-3">Tempo & Emotion Markers</h3>
          <div className="space-y-2">
            {markers.map((marker: any, index: number) => (
              <div
                key={index}
                className="bg-gray-50 dark:bg-gray-900 rounded p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">
                    {marker.emotion} - {marker.tempo}
                  </div>
                  <div className="text-sm text-gray-500">{marker.time}s</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onPrevious}
          className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

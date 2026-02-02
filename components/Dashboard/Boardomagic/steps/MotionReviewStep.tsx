'use client'

interface MotionReviewStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function MotionReviewStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: MotionReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 9: Review Motion</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Review motion descriptions for all shots
        </p>
      </div>

      <div className="space-y-4">
        {project?.shots?.map((shot: any) => (
          <div key={shot.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-2">Shot {shot.shotNumber}</h3>
            <p className="text-gray-700 dark:text-gray-300">
              {shot.motionDescription || 'No motion description'}
            </p>
          </div>
        ))}
      </div>

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

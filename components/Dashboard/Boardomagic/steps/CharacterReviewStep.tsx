'use client'

interface CharacterReviewStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function CharacterReviewStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: CharacterReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 8: Review Characters</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Review all characters across all shots
        </p>
      </div>

      <div className="space-y-4">
        {project?.shots?.map((shot: any) => (
          <div key={shot.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-bold text-lg mb-3">Shot {shot.shotNumber}</h3>
            <div className="space-y-2">
              {shot.characters?.map((char: any, index: number) => (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-gray-900 rounded p-3"
                >
                  <div className="font-medium">Character {char.characterNumber}</div>
                  {char.ethnicity && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Ethnicity: {char.ethnicity}
                    </div>
                  )}
                  {char.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {char.description}
                    </div>
                  )}
                </div>
              ))}
              {(!shot.characters || shot.characters.length === 0) && (
                <p className="text-gray-500 text-sm">No characters in this shot</p>
              )}
            </div>
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

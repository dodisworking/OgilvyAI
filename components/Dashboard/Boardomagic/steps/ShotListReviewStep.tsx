'use client'

import { useState } from 'react'
import ShotCard from '../ShotCard'

interface ShotListReviewStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function ShotListReviewStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: ShotListReviewStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 7: Review Shot List</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Review and edit your shot list
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {project?.shots?.map((shot: any) => (
          <ShotCard
            key={shot.id}
            shotNumber={shot.shotNumber}
            sceneDescription={shot.sceneDescription}
            motionDescription={shot.motionDescription}
            duration={shot.duration}
            characterCount={shot.characters?.length || 0}
          />
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

'use client'

import { useState, useEffect } from 'react'

interface MotionStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function MotionStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: MotionStepProps) {
  const [motions, setMotions] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (project?.shots) {
      const motionMap: Record<string, string> = {}
      project.shots.forEach((shot: any) => {
        motionMap[shot.id] = shot.motionDescription || ''
      })
      setMotions(motionMap)
    }
  }, [project])

  const handleMotionUpdate = (shotId: string, description: string) => {
    setMotions({ ...motions, [shotId]: description })
  }

  const handleSave = async () => {
    if (!project?.id) return

    setIsSaving(true)
    try {
      const motionsArray = Object.entries(motions).map(([shotId, motionDescription]) => ({
        shotId,
        motionDescription,
      }))

      const response = await fetch(`/api/boardomagic/projects/${project.id}/motion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ motions: motionsArray }),
      })

      if (response.ok) {
        // Update project status
        await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'MOTION_REVIEWED' }),
        })

        const projectResponse = await fetch(
          `/api/boardomagic/projects/${project.id}`,
          { credentials: 'include' }
        )
        if (projectResponse.ok) {
          const data = await projectResponse.json()
          onProjectUpdate(data.project)
          onNext()
        }
      }
    } catch (error) {
      console.error('Error saving motion:', error)
      alert('Failed to save motion descriptions')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 6: Motion</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Describe the movement and motion for each shot
        </p>
      </div>

      <div className="space-y-4">
        {project?.shots?.map((shot: any) => (
          <div key={shot.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3">Shot {shot.shotNumber}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Motion Description</label>
              <textarea
                value={motions[shot.id] || ''}
                onChange={(e) => handleMotionUpdate(shot.id, e.target.value)}
                placeholder="Describe the movement, camera motion, character actions, etc..."
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
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
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

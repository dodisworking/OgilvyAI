'use client'

import { useState, useEffect } from 'react'
import ShotCard from '../ShotCard'

interface ShotsConfigurationStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function ShotsConfigurationStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: ShotsConfigurationStepProps) {
  const [numberOfShots, setNumberOfShots] = useState(project?.shots?.length || 0)
  const [shots, setShots] = useState<any[]>(project?.shots || [])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (project?.shots) {
      setShots(project.shots)
      setNumberOfShots(project.shots.length)
    }
  }, [project])

  const handleNumberOfShotsChange = (value: number) => {
    setNumberOfShots(value)
    // Create or remove shots to match the number
    const newShots = []
    for (let i = 1; i <= value; i++) {
      const existingShot = shots.find((s) => s.shotNumber === i)
      if (existingShot) {
        newShots.push(existingShot)
      } else {
        newShots.push({
          shotNumber: i,
          sceneDescription: '',
          duration: 5,
        })
      }
    }
    setShots(newShots)
  }

  const handleShotUpdate = (index: number, field: string, value: any) => {
    const updatedShots = [...shots]
    updatedShots[index] = { ...updatedShots[index], [field]: value }
    setShots(updatedShots)
  }

  const handleSave = async () => {
    if (!project?.id) return

    setIsSaving(true)
    try {
      // Delete existing shots
      if (shots.length > 0) {
        await Promise.all(
          shots.map((shot) =>
            shot.id
              ? fetch(`/api/boardomagic/projects/${project.id}/shots/${shot.id}`, {
                  method: 'DELETE',
                  credentials: 'include',
                })
              : Promise.resolve()
          )
        )
      }

      // Create new shots
      const createdShots = await Promise.all(
        shots.map((shot) =>
          fetch(`/api/boardomagic/projects/${project.id}/shots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(shot),
          }).then((res) => res.json())
        )
      )

      // Update project status
      await fetch(`/api/boardomagic/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'SHOTS_CONFIGURED' }),
      })

      const response = await fetch(`/api/boardomagic/projects/${project.id}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        onProjectUpdate(data.project)
        onNext()
      }
    } catch (error) {
      console.error('Error saving shots:', error)
      alert('Failed to save shots')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-4">Step 2: Shots Configuration</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
          Configure the number of shots and describe each scene
        </p>
      </div>

      <div className="flex-shrink-0">
        <label className="block text-sm font-medium mb-2">Number of Shots</label>
        <select
          value={numberOfShots}
          onChange={(e) => handleNumberOfShotsChange(parseInt(e.target.value) || 0)}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        >
          {Array.from({ length: 30 }, (_, i) => i + 1).map((num) => (
            <option key={num} value={num}>
              {num} {num === 1 ? 'shot' : 'shots'}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-2">
        {shots.map((shot, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3">Shot {shot.shotNumber}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Scene Description</label>
                <textarea
                  value={shot.sceneDescription || ''}
                  onChange={(e) =>
                    handleShotUpdate(index, 'sceneDescription', e.target.value)
                  }
                  placeholder="Describe the scene..."
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  min="1"
                  value={shot.duration || 5}
                  onChange={(e) =>
                    handleShotUpdate(index, 'duration', parseInt(e.target.value) || 5)
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 flex justify-between gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onPrevious}
          className="px-4 md:px-6 py-2 md:py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm md:text-base"
        >
          Previous
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving || shots.some((s) => !s.sceneDescription.trim())}
          className="px-4 md:px-6 py-2 md:py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

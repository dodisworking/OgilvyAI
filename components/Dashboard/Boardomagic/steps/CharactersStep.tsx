'use client'

import { useState, useEffect } from 'react'

interface CharactersStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function CharactersStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: CharactersStepProps) {
  const [characters, setCharacters] = useState<Record<string, any[]>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (project?.shots) {
      const charsByShot: Record<string, any[]> = {}
      project.shots.forEach((shot: any) => {
        charsByShot[shot.id] = shot.characters || []
      })
      setCharacters(charsByShot)
    }
  }, [project])

  const handleCharacterCountChange = (shotId: string, count: number) => {
    const currentChars = characters[shotId] || []
    const newChars = []
    for (let i = 1; i <= count; i++) {
      const existing = currentChars.find((c) => c.characterNumber === i)
      if (existing) {
        newChars.push(existing)
      } else {
        newChars.push({
          shotId,
          characterNumber: i,
          ethnicity: '',
          description: '',
        })
      }
    }
    setCharacters({ ...characters, [shotId]: newChars })
  }

  const handleCharacterUpdate = (
    shotId: string,
    charIndex: number,
    field: string,
    value: string
  ) => {
    const shotChars = [...(characters[shotId] || [])]
    shotChars[charIndex] = { ...shotChars[charIndex], [field]: value }
    setCharacters({ ...characters, [shotId]: shotChars })
  }

  const handleSave = async () => {
    if (!project?.id) return

    setIsSaving(true)
    try {
      // Flatten all characters
      const allCharacters = Object.values(characters).flat()

      const response = await fetch(
        `/api/boardomagic/projects/${project.id}/characters`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ characters: allCharacters }),
        }
      )

      if (response.ok) {
        // Update project status
        await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'CHARACTERS_ADDED' }),
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
      console.error('Error saving characters:', error)
      alert('Failed to save characters')
    } finally {
      setIsSaving(false)
    }
  }

  const ethnicityOptions = [
    'Asian',
    'Black',
    'Hispanic/Latino',
    'Middle Eastern',
    'Native American',
    'Pacific Islander',
    'White',
    'Mixed',
    'Other',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 3: Characters</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Configure characters for each shot, including ethnicity
        </p>
      </div>

      {project?.shots?.map((shot: any) => {
        const shotChars = characters[shot.id] || []
        const charCount = shotChars.length

        return (
          <div key={shot.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Shot {shot.shotNumber}</h3>
              <div>
                <label className="text-sm mr-2">Number of Characters:</label>
                <input
                  type="number"
                  min="0"
                  value={charCount}
                  onChange={(e) =>
                    handleCharacterCountChange(shot.id, parseInt(e.target.value) || 0)
                  }
                  className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div className="space-y-3">
              {shotChars.map((char: any, charIndex: number) => (
                <div
                  key={charIndex}
                  className="bg-gray-50 dark:bg-gray-900 rounded p-3 space-y-2"
                >
                  <h4 className="font-medium">Character {char.characterNumber}</h4>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ethnicity</label>
                    <select
                      value={char.ethnicity || ''}
                      onChange={(e) =>
                        handleCharacterUpdate(shot.id, charIndex, 'ethnicity', e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    >
                      <option value="">Select ethnicity</option>
                      {ethnicityOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <input
                      type="text"
                      value={char.description || ''}
                      onChange={(e) =>
                        handleCharacterUpdate(shot.id, charIndex, 'description', e.target.value)
                      }
                      placeholder="Additional character description..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

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

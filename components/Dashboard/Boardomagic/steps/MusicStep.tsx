'use client'

import { useState, useEffect } from 'react'
import TimelineMarker from '../TimelineMarker'

interface MusicStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

interface TempoMarker {
  time: number
  emotion: string
  tempo: string
}

export default function MusicStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: MusicStepProps) {
  const [description, setDescription] = useState('')
  const [markers, setMarkers] = useState<TempoMarker[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showMarkerForm, setShowMarkerForm] = useState(false)
  const [editingMarker, setEditingMarker] = useState<TempoMarker | null>(null)
  const [markerForm, setMarkerForm] = useState({ time: 0, emotion: '', tempo: '' })

  useEffect(() => {
    if (project?.music) {
      setDescription(project.music.description || '')
      setMarkers(
        (project.music.tempoMarkers as TempoMarker[]) || []
      )
    }
  }, [project])

  const totalDuration = project?.totalDuration || 86400

  const handleAddMarker = () => {
    if (editingMarker) {
      setMarkers(
        markers.map((m) =>
          m.time === editingMarker.time
            ? { ...markerForm, time: markerForm.time }
            : m
        )
      )
      setEditingMarker(null)
    } else {
      setMarkers([...markers, { ...markerForm, time: markerForm.time }])
    }
    setShowMarkerForm(false)
    setMarkerForm({ time: 0, emotion: '', tempo: '' })
  }

  const handleEditMarker = (marker: TempoMarker) => {
    setEditingMarker(marker)
    setMarkerForm({ time: marker.time, emotion: marker.emotion, tempo: marker.tempo })
    setShowMarkerForm(true)
  }

  const handleDeleteMarker = (time: number) => {
    setMarkers(markers.filter((m) => m.time !== time))
  }

  const handleSave = async () => {
    if (!project?.id || !description.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/boardomagic/projects/${project.id}/music`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description,
          tempoMarkers: markers,
        }),
      })

      if (response.ok) {
        // Update project status
        await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'MUSIC_ADDED' }),
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
      console.error('Error saving music:', error)
      alert('Failed to save music description')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 5: Music</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Describe the music and add tempo/emotion markers throughout the boardomatic
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Music Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the overall music style, mood, instruments, etc..."
          rows={5}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium">Tempo & Emotion Markers</label>
          <button
            onClick={() => {
              setShowMarkerForm(true)
              setEditingMarker(null)
              setMarkerForm({ time: 0, emotion: '', tempo: '' })
            }}
            className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            + Add Marker
          </button>
        </div>

        {showMarkerForm && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Time (seconds)</label>
              <input
                type="number"
                min="0"
                max={totalDuration}
                value={markerForm.time}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, time: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Emotion</label>
              <input
                type="text"
                value={markerForm.emotion}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, emotion: e.target.value })
                }
                placeholder="e.g., Intense, Calm, Energetic"
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tempo</label>
              <input
                type="text"
                value={markerForm.tempo}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, tempo: e.target.value })
                }
                placeholder="e.g., Fast, Slow, Building"
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddMarker}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                {editingMarker ? 'Update' : 'Add'}
              </button>
              <button
                onClick={() => {
                  setShowMarkerForm(false)
                  setEditingMarker(null)
                  setMarkerForm({ time: 0, emotion: '', tempo: '' })
                }}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="relative bg-gray-100 dark:bg-gray-900 rounded-lg p-4" style={{ minHeight: '100px' }}>
          <div className="text-sm text-gray-500 mb-2">
            Timeline (0s - {totalDuration}s)
          </div>
          {markers.map((marker, index) => (
            <TimelineMarker
              key={index}
              marker={marker}
              totalDuration={totalDuration}
              onEdit={handleEditMarker}
              onDelete={() => handleDeleteMarker(marker.time)}
            />
          ))}
        </div>
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
          disabled={isSaving || !description.trim()}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

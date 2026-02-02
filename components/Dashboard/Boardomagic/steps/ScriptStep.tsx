'use client'

import { useState, useEffect } from 'react'

interface ScriptStepProps {
  project?: any
  onNext: () => void
  onProjectUpdate: (project: any) => void
}

export default function ScriptStep({ project, onNext, onProjectUpdate }: ScriptStepProps) {
  const [title, setTitle] = useState(project?.title || '')
  const [script, setScript] = useState(project?.script || '')
  const [totalDuration, setTotalDuration] = useState(project?.totalDuration || 60) // Default 60 seconds (1 minute)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a project title')
      return
    }
    if (!script.trim()) {
      alert('Please enter your script')
      return
    }

    setIsSaving(true)
    try {
      if (project?.id) {
        // Update existing project
        const response = await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title,
            script,
            totalDuration,
            status: 'SCRIPT_ADDED',
          }),
        })
        if (response.ok) {
          const data = await response.json()
          onProjectUpdate(data.project)
          // Small delay to ensure state updates before navigation
          setTimeout(() => {
            onNext()
          }, 100)
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to save script')
        }
      } else {
        // Create new project
        const response = await fetch('/api/boardomagic/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title,
            script,
            totalDuration,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          onProjectUpdate(data.project)
          // Small delay to ensure state updates before navigation
          setTimeout(() => {
            onNext()
          }, 100)
        } else {
          const errorData = await response.json()
          alert(errorData.error || 'Failed to create project')
        }
      }
    } catch (error) {
      console.error('Error saving script:', error)
      alert('Failed to save script')
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <div className="space-y-4 md:space-y-6 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h2 className="text-xl md:text-2xl font-bold mb-2 md:mb-4">Step 1: Script Input</h2>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
          Paste your script below and configure the project settings
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Project Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter project title"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-medium mb-2">Script</label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Paste your script here..."
          rows={12}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm flex-1 resize-none"
        />
      </div>

      <div className="flex-shrink-0">
        <label className="block text-sm font-medium mb-2">
          Boardomatic Duration (seconds)
        </label>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Seconds (max 60)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={totalDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1
                setTotalDuration(Math.min(60, Math.max(1, val)))
              }}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Total: {totalDuration} seconds ({Math.floor(totalDuration / 60)}m {totalDuration % 60}s)
        </p>
        <p className="text-xs text-gray-400 mt-1 italic">
          Note: The boardomatic video will be up to 1 minute. The 24-hour timeframe refers to the process of perfecting your boardomatic, not the video duration.
        </p>
      </div>

      <div className="flex-shrink-0 flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={isSaving || !title.trim() || !script.trim()}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

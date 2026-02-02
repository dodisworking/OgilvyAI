'use client'

import { useState } from 'react'

interface NewProjectModalProps {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export default function NewProjectModal({ onClose, onCreate }: NewProjectModalProps) {
  const [projectName, setProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!projectName.trim()) {
      alert('Please enter a project name')
      return
    }

    setIsCreating(true)
    try {
      await onCreate(projectName.trim())
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setIsCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
        <h2 className="text-2xl font-bold mb-4">Create New Boardomatic</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Give your boardomatic project a name
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Project Name</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && projectName.trim()) {
                handleCreate()
              }
            }}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !projectName.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

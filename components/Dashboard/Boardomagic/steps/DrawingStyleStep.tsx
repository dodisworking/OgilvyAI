'use client'

import { useState, useEffect } from 'react'

interface DrawingStyleStepProps {
  project?: any
  onNext: () => void
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function DrawingStyleStep({
  project,
  onNext,
  onPrevious,
  onProjectUpdate,
}: DrawingStyleStepProps) {
  const [references, setReferences] = useState<any[]>([])
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (project?.drawingStyle) {
      setReferences(project.drawingStyle.references || [])
      setSelectedStyleId(project.drawingStyle.selectedStyleId)
      setDescription(project.drawingStyle.description || '')
    }
  }, [project])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !project?.id) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', project.id)

      const uploadResponse = await fetch('/api/upload/boardomagic-style', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (uploadResponse.ok) {
        const { url, filename } = await uploadResponse.json()

        // Add reference to style
        const styleResponse = await fetch(
          `/api/boardomagic/projects/${project.id}/style`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ imageUrl: url, description: '' }),
          }
        )

        if (styleResponse.ok) {
          const { reference } = await styleResponse.json()
          setReferences([...references, reference])
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSelectStyle = async (styleId: string) => {
    setSelectedStyleId(styleId)
  }

  const handleSave = async () => {
    if (!project?.id) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/boardomagic/projects/${project.id}/style`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          selectedStyleId,
          description,
        }),
      })

      if (response.ok) {
        // Update project status
        await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'STYLE_SELECTED' }),
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
      console.error('Error saving style:', error)
      alert('Failed to save style selection')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 4: Drawing Style</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Upload reference images and select your preferred drawing style
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Upload Reference Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        />
        {isUploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
      </div>

      {references.length > 0 && (
        <div>
          <h3 className="font-bold mb-3">Reference Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {references.map((ref) => (
              <div
                key={ref.id}
                className={`
                  border-2 rounded-lg overflow-hidden cursor-pointer transition-all
                  ${
                    selectedStyleId === ref.id
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-200 dark:border-gray-700'
                  }
                `}
                onClick={() => handleSelectStyle(ref.id)}
              >
                <img
                  src={ref.imageUrl}
                  alt={ref.description || 'Style reference'}
                  className="w-full h-48 object-cover"
                />
                <div className="p-2">
                  <p className="text-sm font-medium">
                    {selectedStyleId === ref.id && '✓ '}
                    Reference {ref.id.slice(-6)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Style Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the drawing style..."
          rows={3}
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
        />
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
          disabled={isSaving || !selectedStyleId}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  )
}

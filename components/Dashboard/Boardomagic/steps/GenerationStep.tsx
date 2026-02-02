'use client'

import { useState, useEffect } from 'react'
import VideoPlayer from '../VideoPlayer'

interface GenerationStepProps {
  project?: any
  onPrevious: () => void
  onProjectUpdate: (project: any) => void
}

export default function GenerationStep({
  project,
  onPrevious,
  onProjectUpdate,
}: GenerationStepProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [output, setOutput] = useState<any>(null)

  useEffect(() => {
    if (project?.id) {
      loadOutput()
    }
  }, [project])

  const loadOutput = async () => {
    if (!project?.id) return
    try {
      const response = await fetch(
        `/api/boardomagic/projects/${project.id}/output`,
        { credentials: 'include' }
      )
      if (response.ok) {
        const data = await response.json()
        setOutput(data.output)
      }
    } catch (error) {
      console.error('Error loading output:', error)
    }
  }

  const handleGenerate = async () => {
    if (!project?.id) return

    setIsGenerating(true)
    try {
      const response = await fetch(
        `/api/boardomagic/projects/${project.id}/generate`,
        {
          method: 'POST',
          credentials: 'include',
        }
      )

      if (response.ok) {
        // Update project status
        await fetch(`/api/boardomagic/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'READY_TO_GENERATE' }),
        })

        // Poll for output status
        setTimeout(() => {
          loadOutput()
        }, 2000)
      }
    } catch (error) {
      console.error('Error generating boardomatic:', error)
      alert('Failed to start generation')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Step 11: Generate Boardomatic</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Review your project and generate the final boardomatic
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 space-y-4">
        <h3 className="font-bold text-lg">Project Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Title:</span>{' '}
            <span className="font-medium">{project?.title}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Duration:</span>{' '}
            <span className="font-medium">
              {project?.totalDuration
                ? `${project.totalDuration}s (${Math.floor(project.totalDuration / 60)}m ${project.totalDuration % 60}s)`
                : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Number of Shots:</span>{' '}
            <span className="font-medium">{project?.shots?.length || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Status:</span>{' '}
            <span className="font-medium">{project?.status}</span>
          </div>
        </div>
      </div>

      {output?.videoUrl ? (
        <div>
          <VideoPlayer videoUrl={output.videoUrl} title="Generated Boardomatic" />
        </div>
      ) : (
        <div className="text-center py-12">
          {isGenerating ? (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Generating your boardomatic...
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This is a placeholder. AI video generation will be integrated here.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Ready to generate your boardomatic!
              </p>
              <button
                onClick={handleGenerate}
                className="px-8 py-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium text-lg"
              >
                Generate Boardomatic
              </button>
              <p className="text-xs text-gray-500 mt-4">
                Note: This will trigger a placeholder generation. AI video generation APIs will be
                integrated in the future.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-start">
        <button
          onClick={onPrevious}
          className="px-6 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Previous
        </button>
      </div>
    </div>
  )
}

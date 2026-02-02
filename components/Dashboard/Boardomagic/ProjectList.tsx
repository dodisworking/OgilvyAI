'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'

interface ProjectListProps {
  onSelectProject: (projectId: string) => void
  onCreateNew: () => void
}

export default function ProjectList({ onSelectProject, onCreateNew }: ProjectListProps) {
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/boardomagic/projects', {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      SCRIPT_ADDED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      SHOTS_CONFIGURED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      CHARACTERS_ADDED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      STYLE_SELECTED: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      MUSIC_ADDED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      MOTION_REVIEWED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      READY_TO_GENERATE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      GENERATING: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase())
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Your Boardomatics</h2>
        <button
          onClick={onCreateNew}
          className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
        >
          + New Boardomatic
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No boardomatics yet. Create your first one!
          </p>
          <button
            onClick={onCreateNew}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all font-medium"
          >
            Create New Boardomatic
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 cursor-pointer transition-all"
            >
              <h3 className="font-bold text-lg mb-2">{project.title}</h3>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                    project.status
                  )}`}
                >
                  {getStatusLabel(project.status)}
                </span>
              </div>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Shots: {project.shots?.length || 0}</p>
                <p>Duration: {project.totalDuration}s</p>
                <p>Updated: {format(new Date(project.updatedAt), 'MMM d, yyyy')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

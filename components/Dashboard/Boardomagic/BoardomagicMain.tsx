'use client'

import { useState, useEffect } from 'react'
import WorkflowStepper from './WorkflowStepper'
import ProjectList from './ProjectList'
import NewProjectModal from './NewProjectModal'
import ScriptStep from './steps/ScriptStep'
import ShotsConfigurationStep from './steps/ShotsConfigurationStep'
import CharactersStep from './steps/CharactersStep'
import DrawingStyleStep from './steps/DrawingStyleStep'
import MusicStep from './steps/MusicStep'
import MotionStep from './steps/MotionStep'
import ShotListReviewStep from './steps/ShotListReviewStep'
import CharacterReviewStep from './steps/CharacterReviewStep'
import MotionReviewStep from './steps/MotionReviewStep'
import MusicReviewStep from './steps/MusicReviewStep'
import GenerationStep from './steps/GenerationStep'

const STEP_NAMES = [
  'Script',
  'Shots',
  'Characters',
  'Style',
  'Music',
  'Motion',
  'Review Shots',
  'Review Characters',
  'Review Motion',
  'Review Music',
  'Generate',
]

interface BoardomagicMainProps {
  projectId?: string
  onClose?: () => void
}

export default function BoardomagicMain({ projectId, onClose }: BoardomagicMainProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [project, setProject] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(!!projectId)
  const [showProjectList, setShowProjectList] = useState(!projectId)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadProject()
    }
  }, [projectId])

  const loadProject = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/boardomagic/projects/${projectId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setProject(data.project)
        // Determine current step based on project status
        const statusStepMap: Record<string, number> = {
          DRAFT: 1,
          SCRIPT_ADDED: 2,
          SHOTS_CONFIGURED: 3,
          CHARACTERS_ADDED: 4,
          STYLE_SELECTED: 5,
          MUSIC_ADDED: 6,
          MOTION_REVIEWED: 7,
          READY_TO_GENERATE: 11,
          GENERATING: 11,
          COMPLETED: 11,
        }
        setCurrentStep(statusStepMap[data.project.status] || 1)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStepChange = (step: number) => {
    if (step >= 1 && step <= STEP_NAMES.length) {
      setCurrentStep(step)
    }
  }

  const handleNext = () => {
    if (currentStep < STEP_NAMES.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleProjectUpdate = (updatedProject: any) => {
    setProject(updatedProject)
    // Don't auto-update step here - let manual navigation (onNext) handle it
  }

  const handleSelectProject = async (selectedProjectId: string) => {
    setIsLoading(true)
    setShowProjectList(false)
    try {
      const response = await fetch(`/api/boardomagic/projects/${selectedProjectId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setProject(data.project)
        // Determine current step based on project status
        const statusStepMap: Record<string, number> = {
          DRAFT: 1,
          SCRIPT_ADDED: 2,
          SHOTS_CONFIGURED: 3,
          CHARACTERS_ADDED: 4,
          STYLE_SELECTED: 5,
          MUSIC_ADDED: 6,
          MOTION_REVIEWED: 7,
          READY_TO_GENERATE: 11,
          GENERATING: 11,
          COMPLETED: 11,
        }
        setCurrentStep(statusStepMap[data.project.status] || 1)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateNew = async (projectName: string) => {
    setIsLoading(true)
    setShowNewProjectModal(false)
    try {
      console.log('Creating project with name:', projectName)
      const response = await fetch('/api/boardomagic/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: projectName,
          script: '', // Empty initially
          totalDuration: 60, // Default 60 seconds
        }),
      })
      
      const responseData = await response.json()
      console.log('Response status:', response.status)
      console.log('Response data:', responseData)
      
      if (response.ok) {
        setProject(responseData.project)
        setCurrentStep(1) // Start at script step
        setShowProjectList(false)
      } else {
        const errorMessage = responseData.error || responseData.details || 'Failed to create project'
        console.error('Failed to create project:', errorMessage)
        alert(`Failed to create project: ${errorMessage}`)
        setShowNewProjectModal(true)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setShowNewProjectModal(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToProjects = () => {
    setShowProjectList(true)
    setProject(null)
    setCurrentStep(1)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (showProjectList) {
    return (
      <div className="w-full h-full flex flex-col p-4 md:p-6">
        <div className="mb-4 flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              🎬 Boardomagic
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
              Create your storyboard and boardomatic (up to 1 minute)
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 border border-purple-200 dark:border-purple-800 flex-1 overflow-y-auto min-h-0">
          <ProjectList
            onSelectProject={handleSelectProject}
            onCreateNew={() => setShowNewProjectModal(true)}
          />
        </div>

        {showNewProjectModal && (
          <NewProjectModal
            onClose={() => setShowNewProjectModal(false)}
            onCreate={handleCreateNew}
          />
        )}
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-6">
      <div className="mb-4 flex-shrink-0 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🎬 Boardomagic
          </h1>
          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">
            Create your storyboard and boardomatic (up to 1 minute)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBackToProjects}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            ← Back to Projects
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Close
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex-shrink-0">
        <WorkflowStepper
          currentStep={currentStep}
          totalSteps={STEP_NAMES.length}
          stepNames={STEP_NAMES}
          onStepClick={handleStepChange}
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 border border-purple-200 dark:border-purple-800 flex-1 overflow-y-auto min-h-0">
        {currentStep === 1 && (
          <ScriptStep
            project={project}
            onNext={handleNext}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 2 && (
          <ShotsConfigurationStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 3 && (
          <CharactersStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 4 && (
          <DrawingStyleStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 5 && (
          <MusicStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 6 && (
          <MotionStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 7 && (
          <ShotListReviewStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 8 && (
          <CharacterReviewStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 9 && (
          <MotionReviewStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 10 && (
          <MusicReviewStep
            project={project}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
        {currentStep === 11 && (
          <GenerationStep
            project={project}
            onPrevious={handlePrevious}
            onProjectUpdate={handleProjectUpdate}
          />
        )}
      </div>
    </div>
  )
}

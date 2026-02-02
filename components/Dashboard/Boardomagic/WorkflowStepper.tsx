'use client'

interface WorkflowStepperProps {
  currentStep: number
  totalSteps: number
  stepNames: string[]
  onStepClick?: (step: number) => void
}

export default function WorkflowStepper({
  currentStep,
  totalSteps,
  stepNames,
  onStepClick,
}: WorkflowStepperProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {stepNames.map((name, index) => {
          const stepNumber = index + 1
          const isActive = stepNumber === currentStep
          const isCompleted = stepNumber < currentStep
          const isClickable = onStepClick && (isCompleted || isActive)

          return (
            <div key={index} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick?.(stepNumber)}
                  disabled={!isClickable}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    transition-all duration-300
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white ring-4 ring-purple-200'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }
                    ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
                  `}
                >
                  {isCompleted ? '✓' : stepNumber}
                </button>
                <span
                  className={`
                    mt-2 text-xs text-center max-w-[100px]
                    ${isActive ? 'font-bold text-purple-600 dark:text-purple-400' : 'text-gray-500'}
                  `}
                >
                  {name}
                </span>
              </div>
              {index < stepNames.length - 1 && (
                <div
                  className={`
                    flex-1 h-1 mx-2 transition-all duration-300
                    ${isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                  `}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

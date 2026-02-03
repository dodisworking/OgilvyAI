'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, startOfWeek, parseISO, addWeeks } from 'date-fns'
import TimelineList from './ProductionScheduleMaker/TimelineList'
import NewTimelineModal from './ProductionScheduleMaker/NewTimelineModal'

interface Brush {
  id: string
  name: string
  color: string
  isDefault?: boolean
}

interface ScheduleDay {
  date: string // YYYY-MM-DD
  brushes: string[] // Array of brush IDs in order (top to bottom)
  glueId?: string // If part of a glued group (deprecated - use brushGlueIds)
  brushGlueIds?: Record<number, string> // Map of brush index to glue group ID
  customLabels?: Record<number, string> // Map of brush index to custom label
  customColors?: Record<number, string> // Map of brush index to hex color override
}

interface GlueGroup {
  id: string
  dates: string[] // Array of date strings
}

interface MergeGroup {
  id: string
  dates: string[] // Array of date strings (must be consecutive)
  brushId: string // The brush that was merged
  brushIndex: number // The index of the brush in the first date
  label?: string // Custom label if any
}

export default function ProductionScheduleMaker() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [visibleMonths, setVisibleMonths] = useState<Date[]>([new Date()]) // Array of months to display
  const [selectedBrush, setSelectedBrush] = useState<string | null>(null)
  const [isGlueMode, setIsGlueMode] = useState(false)
  const [sabbathMode, setSabbathMode] = useState(false) // When true, skips weekends (keeps Saturday/Sunday free)
  const [showAIModal, setShowAIModal] = useState(false)
  const [pendingAIResult, setPendingAIResult] = useState<
    | { kind: 'recognize'; summary: string; sentToOpenAI: { prompt: string; imageCount: number } }
    | { kind: 'schedule'; schedule: unknown[]; rawResponse: string; sentToOpenAI: { prompt: string; imageCount: number } }
    | null
  >(null)
  const [showBrushCreator, setShowBrushCreator] = useState(false)
  const [newBrushName, setNewBrushName] = useState('')
  const [newBrushColor, setNewBrushColor] = useState('#3b82f6')
  const [aiInput, setAiInput] = useState('')
  const [isAILoading, setIsAILoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pdfPageImages, setPdfPageImages] = useState<string[]>([])
  const [pdfFileName, setPdfFileName] = useState('')
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showTimelineList, setShowTimelineList] = useState(true)
  const [showNewTimelineModal, setShowNewTimelineModal] = useState(false)
  const [currentTimelineId, setCurrentTimelineId] = useState<string | null>(null)
  const [currentTimelineTitle, setCurrentTimelineTitle] = useState<string>('')
  const [isEditMode, setIsEditMode] = useState(false) // Edit mode for changing labels
  const [editingDate, setEditingDate] = useState<{ dateStr: string; brushIndex: number } | null>(null) // Which date/brush is being edited inline
  const [editingLabel, setEditingLabel] = useState('') // Current label being edited
  const [showBrushDropdown, setShowBrushDropdown] = useState(false) // Show brush dropdown
  const [isMergeMode, setIsMergeMode] = useState(false) // Merge mode for combining consecutive dates
  const [pendingMergeDates, setPendingMergeDates] = useState<string[]>([]) // Dates selected for merging (for backward compat)
  const [pendingMergeSelections, setPendingMergeSelections] = useState<Array<{ dateStr: string; brushIndex: number; brushId: string }>>([]) // Per-stripe selections for merging
  const [pendingMergeBrushId, setPendingMergeBrushId] = useState<string | null>(null) // Brush ID being merged
  const [pendingMergeBrushIndex, setPendingMergeBrushIndex] = useState<number | null>(null) // Brush index being merged
  const [mergeGlueGroups, setMergeGlueGroups] = useState<Set<string>>(new Set()) // Track which glue groups are "merged" (for visual rendering)
  const [isUnmergeMode, setIsUnmergeMode] = useState(false) // Unmerge mode for splitting merged blocks
  const [isCopyPasteMode, setIsCopyPasteMode] = useState(false) // Hand: copy color+label from one block, paste to another
  const [copyPasteCaptured, setCopyPasteCaptured] = useState<{ brushId: string; label: string; dateStr: string; brushIndex: number } | null>(null)
  const [isEraserMode, setIsEraserMode] = useState(false) // Soap: tap block to delete it
  const [isPaintMode, setIsPaintMode] = useState(false) // 🖌️: select color then click blocks to change color
  const [paintColor, setPaintColor] = useState('#3b82f6')

  // Default brushes
  const [brushes, setBrushes] = useState<Brush[]>([
    { id: 'creative-review', name: 'Creative Review', color: '#3b82f6', isDefault: true },
    { id: 'client-meeting', name: 'Client Meeting', color: '#ef4444', isDefault: true },
    { id: 'production', name: 'Production', color: '#10b981', isDefault: true },
    { id: 'post-production', name: 'Post-Production', color: '#f59e0b', isDefault: true },
    { id: 'pre-production', name: 'Pre-Production', color: '#8b5cf6', isDefault: true },
    { id: 'vfx', name: 'VFX', color: '#ec4899', isDefault: true },
    { id: 'audio-mix', name: 'Audio Mix', color: '#06b6d4', isDefault: true },
    { id: 'color-grade', name: 'Color Grade', color: '#fbbf24', isDefault: true },
  ])

  const [schedule, setSchedule] = useState<Record<string, ScheduleDay>>({})
  const [glueGroups, setGlueGroups] = useState<Record<string, GlueGroup>>({})
  const [activeGlueGroupId, setActiveGlueGroupId] = useState<string | null>(null) // Track the glue group being built
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null) // Position for drag preview
  const [isDraggingState, setIsDraggingState] = useState(false) // State to trigger re-renders during drag
  
  // Undo/Redo history
  const [history, setHistory] = useState<Array<{ schedule: Record<string, ScheduleDay>; glueGroups: Record<string, GlueGroup> }>>([])
  const [historyIndex, setHistoryIndex] = useState(-1) // Current position in history (-1 means no history)
  const maxHistorySize = 50 // Limit history to prevent memory issues
  
  // Deep clone function for history
  const deepCloneSchedule = useCallback((sched: Record<string, ScheduleDay>): Record<string, ScheduleDay> => {
    const cloned: Record<string, ScheduleDay> = {}
    Object.keys(sched).forEach(key => {
      cloned[key] = {
        ...sched[key],
        brushes: [...sched[key].brushes],
        brushGlueIds: sched[key].brushGlueIds ? { ...sched[key].brushGlueIds } : undefined,
        customLabels: sched[key].customLabels ? { ...sched[key].customLabels } : undefined,
        customColors: sched[key].customColors ? { ...sched[key].customColors } : undefined,
      }
    })
    return cloned
  }, [])

  // Helper to check if dates are consecutive
  const areConsecutiveDates = useCallback((dateStrings: string[]): boolean => {
    if (dateStrings.length < 2) return false
    const sorted = [...dateStrings].sort()
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1])
      const curr = new Date(sorted[i])
      const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays !== 1) return false
    }
    return true
  }, [])
  
  // Helper to check if dates are consecutive accounting for weekends
  // When Sabbath mode is OFF: weekends break the chain (Friday->Sunday is NOT consecutive)
  // When Sabbath mode is ON: weekends are skipped (Friday->Monday is consecutive)
  const areConsecutiveDatesWithWeekendCheck = useCallback((dateStrings: string[], sabbathModeActive: boolean): boolean => {
    if (dateStrings.length < 2) return false
    const sorted = [...dateStrings].sort()
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1])
      const curr = new Date(sorted[i])
      const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      
      if (sabbathModeActive) {
        // In Sabbath mode, skip weekends - check if dates are consecutive weekdays
        // Friday (5) -> Monday (1) is consecutive (skip Sat/Sun)
        const prevDayOfWeek = prev.getDay()
        const currDayOfWeek = curr.getDay()
        
        // If prev is Friday (5) and curr is Monday (1), that's consecutive (skip weekend)
        if (prevDayOfWeek === 5 && currDayOfWeek === 1 && diffDays === 3) {
          continue // This is consecutive in Sabbath mode
        }
        
        // Otherwise, must be exactly 1 day apart (consecutive weekdays)
        if (diffDays !== 1) return false
        
        // Both must be weekdays (Monday-Friday: 1-5)
        if (prevDayOfWeek === 0 || prevDayOfWeek === 6 || currDayOfWeek === 0 || currDayOfWeek === 6) {
          return false
        }
      } else {
        // Sabbath mode OFF: weekends break the chain
        // Must be exactly 1 day apart, and no weekend in between
        if (diffDays !== 1) return false
        
        // Check if there's a weekend between them
        const prevDayOfWeek = prev.getDay()
        const currDayOfWeek = curr.getDay()
        
        // If prev is Friday (5) and curr is Sunday (0), that's NOT consecutive (Saturday breaks it)
        // If prev is Saturday (6) and curr is Monday (1), that's NOT consecutive (Sunday breaks it)
        if ((prevDayOfWeek === 5 && currDayOfWeek === 0) || (prevDayOfWeek === 6 && currDayOfWeek === 1)) {
          return false
        }
      }
    }
    return true
  }, [])
  
  const deepCloneGlueGroups = useCallback((groups: Record<string, GlueGroup>): Record<string, GlueGroup> => {
    const cloned: Record<string, GlueGroup> = {}
    Object.keys(groups).forEach(key => {
      cloned[key] = {
        ...groups[key],
        dates: [...groups[key].dates],
      }
    })
    return cloned
  }, [])
  
  // Save current state to history before making changes
  const saveToHistory = useCallback(() => {
    setHistoryIndex(currentIndex => {
      setHistory(prev => {
        const newHistory = prev.slice(0, currentIndex + 1) // Remove any "future" history if we're not at the end
        const newState = {
          schedule: deepCloneSchedule(schedule),
          glueGroups: deepCloneGlueGroups(glueGroups),
        }
        
        // Add new state to history
        const updated = [...newHistory, newState]
        
        // Limit history size
        if (updated.length > maxHistorySize) {
          return updated.slice(1) // Remove oldest entry
        }
        
        return updated
      })
      
      const newIndex = currentIndex + 1
      // If we're at max size, stay at the same index (oldest was removed)
      return newIndex >= maxHistorySize ? maxHistorySize - 1 : newIndex
    })
  }, [schedule, glueGroups, deepCloneSchedule, deepCloneGlueGroups])
  
  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndex >= 0 && history[historyIndex]) {
      const previousState = history[historyIndex]
      setSchedule(deepCloneSchedule(previousState.schedule))
      setGlueGroups(deepCloneGlueGroups(previousState.glueGroups))
      setHistoryIndex(prev => prev - 1)
      setHasUnsavedChanges(true)
    }
  }, [history, historyIndex, deepCloneSchedule, deepCloneGlueGroups])
  
  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setSchedule(deepCloneSchedule(nextState.schedule))
      setGlueGroups(deepCloneGlueGroups(nextState.glueGroups))
      setHistoryIndex(prev => prev + 1)
      setHasUnsavedChanges(true)
    }
  }, [history, historyIndex, deepCloneSchedule, deepCloneGlueGroups])
  
  // Check if undo/redo is available
  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1
  
  // Clear all dates from schedule
  const handleClearAll = useCallback(() => {
    if (!confirm('Are you sure you want to clear all dates? This cannot be undone.')) {
      return
    }
    
    setIsEraserMode(false)
    setIsCopyPasteMode(false)
    setCopyPasteCaptured(null)
    saveToHistory() // Save state before clearing
    setSchedule({})
    setGlueGroups({})
    setHasUnsavedChanges(true)
  }, [saveToHistory])
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          handleUndo()
        }
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        if (canRedo) {
          handleRedo()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, handleUndo, handleRedo])
  
  // Drag state for painting
  const dragState = useRef<{
    isDragging: boolean
    startDate: string | null
    isGlueDrag: boolean
    glueGroupId: string | null
    mouseMoved: boolean
    lastGlueDragDate: string | null // Track last date we dragged to for glue
    sourceBrushes: string[] | null // Brushes to move when dragging in glue mode
    sourceBrushIndex: number | null // Which brush index was clicked (for per-stripe glue)
    sourceBrushIndices: number[] | null // All brush indices being dragged (for multi-stripe glue)
    sourceBrushGlueIds: Record<number, string> | null // Glue IDs for each brush index being moved
    connectedDates: Array<{ dateStr: string; brushIndex: number; brushId: string }> | null // All dates connected via the same glue ID
    sourceDateStr: string | null // The original date being dragged (for calculating relative spacing)
    dragStartTime: number | null // Track when drag started for click vs hold
    mouseX: number | null // Mouse X position for drag preview
    mouseY: number | null // Mouse Y position for drag preview
    isHolding: boolean // Whether we're in the hold phase (before drag starts)
  }>({
    isDragging: false,
    startDate: null,
    isGlueDrag: false,
    glueGroupId: null,
    mouseMoved: false,
      lastGlueDragDate: null,
      sourceBrushes: null,
      sourceBrushIndex: null,
      sourceBrushIndices: null,
      sourceBrushGlueIds: null,
      connectedDates: null,
      sourceDateStr: null,
      dragStartTime: null,
      mouseX: null,
      mouseY: null,
      isHolding: false,
  })

  // Track if we need to prevent click after drag
  const preventClickAfterDrag = useRef(false)
  
  // Track drag timeout for cleanup
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const colorPalette = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7'
  ]

  // Generate calendar days for all visible months - only show dates for each specific month
  const allCalendarDays = visibleMonths.map(month => {
    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
    
    // Only use the days that belong to this month - no previous/next month dates
    const days: Date[] = [...daysInMonth]
    
    // Calculate how many days we need to fill a complete week grid
    const firstDayOfWeek = monthStart.getDay() // 0 = Sunday, 1 = Monday, etc.
    const totalDaysInMonth = daysInMonth.length
    const lastDayOfWeek = monthEnd.getDay()
    
    // Calculate empty cells needed at the start and end
    const emptyCellsAtStart = firstDayOfWeek
    const emptyCellsAtEnd = 6 - lastDayOfWeek
    
    return { month, days, emptyCellsAtStart, emptyCellsAtEnd }
  })
  
  // Helper to add previous month
  const addPreviousMonth = useCallback(() => {
    setVisibleMonths(prev => {
      const firstMonth = prev[0]
      const newMonth = subMonths(firstMonth, 1)
      return [newMonth, ...prev]
    })
  }, [])
  
  // Helper to add next month
  const addNextMonth = useCallback(() => {
    setVisibleMonths(prev => {
      const lastMonth = prev[prev.length - 1]
      const newMonth = addMonths(lastMonth, 1)
      return [...prev, newMonth]
    })
  }, [])

  const getScheduleDay = useCallback((dateStr: string): ScheduleDay => {
    if (schedule[dateStr]) {
      return schedule[dateStr]
    }
    return {
      date: dateStr,
      brushes: [],
    }
  }, [schedule])

  // Handle merge mode click - works per-stripe (like glue mode)
  const handleMergeClick = useCallback((date: Date, e?: React.MouseEvent) => {
    if (!isMergeMode) return
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const day = getScheduleDay(dateStr)
    
    if (day.brushes.length === 0) return
    
    // Check if click was on a specific stripe
    let brushIndex: number | null = null
    let brushId: string | null = null
    
    if (e) {
      const target = e.target as HTMLElement
      const stripeElement = target.closest('[data-brush-index]')
      if (stripeElement) {
        brushIndex = parseInt(stripeElement.getAttribute('data-brush-index') || '-1')
        if (brushIndex >= 0 && brushIndex < day.brushes.length) {
          brushId = day.brushes[brushIndex]
        } else {
          brushIndex = null
        }
      }
    }
    
    // If no specific stripe clicked, don't do anything (require clicking on a stripe)
    if (brushIndex === null || brushId === null) return
    
    // Toggle this specific stripe selection
    setPendingMergeSelections(prev => {
      const existingIndex = prev.findIndex(sel => sel.dateStr === dateStr && sel.brushIndex === brushIndex)
      
      if (existingIndex >= 0) {
        // Remove this selection
        const updated = prev.filter((_, idx) => idx !== existingIndex)
        // Update brush ID tracking if this was the first selection
        if (updated.length === 0) {
          setPendingMergeBrushId(null)
          setPendingMergeBrushIndex(null)
        }
        // Update dates list for backward compat
        const remainingDates = [...new Set(updated.map(s => s.dateStr))].sort()
        setPendingMergeDates(remainingDates)
        return updated
      } else {
        // Add this selection
        // If this is the first selection, set the brush ID
        if (prev.length === 0) {
          setPendingMergeBrushId(brushId)
          setPendingMergeBrushIndex(brushIndex)
        } else {
          // Validate: must be the same brush ID (can be at different indices)
          if (prev[0].brushId !== brushId) {
            // Different brush - don't add, show message?
            return prev
          }
        }
        
        const updated = [...prev, { dateStr, brushIndex, brushId }]
        // Update dates list for backward compat
        const remainingDates = [...new Set(updated.map(s => s.dateStr))].sort()
        setPendingMergeDates(remainingDates)
        return updated
      }
    })
  }, [isMergeMode, getScheduleDay])

  // Confirm merge - creates a permanent glue group and marks it as merged for visual rendering
  // Now supports merging specific brush indices, adding brush to dates that don't have it
  const handleConfirmMerge = useCallback(() => {
    if (pendingMergeSelections.length < 2) {
      alert('Please select at least 2 consecutive dates to merge')
      return
    }
    
    // Get unique dates from selections
    const selectedDates = [...new Set(pendingMergeSelections.map(s => s.dateStr))].sort()
    
    if (!areConsecutiveDates(selectedDates)) {
      alert('Selected dates must be consecutive')
      return
    }
    
    if (!pendingMergeBrushId) {
      alert('Please select a brush to merge by clicking on a specific stripe')
      return
    }
    
    saveToHistory()
    
    const brushId = pendingMergeBrushId
    
    // Find the highest merged index across all selected dates to place new merged block below existing ones
    let maxMergedIndex = -1
    selectedDates.forEach(dateStr => {
      const day = schedule[dateStr] || { date: dateStr, brushes: [] }
      const brushGlueIds = day.brushGlueIds || {}
      Object.keys(brushGlueIds).forEach(key => {
        const idx = parseInt(key)
        const glueId = brushGlueIds[idx]
        if (glueId && mergeGlueGroups.has(glueId)) {
          if (idx > maxMergedIndex) {
            maxMergedIndex = idx
          }
        }
      })
    })
    
    // Place new merged block after all existing merged blocks (or at 0 if none exist)
    const targetBrushIndex = maxMergedIndex + 1
    
    // Create a glue group (permanent) - same as glue mode but permanent
    const glueGroupId = `merge-glue-${Date.now()}`
    
    setGlueGroups(prev => ({
      ...prev,
      [glueGroupId]: {
        id: glueGroupId,
        dates: selectedDates,
      },
    }))
    
    // Mark this glue group as "merged" for visual rendering
    setMergeGlueGroups(prev => new Set([...prev, glueGroupId]))
    
    // Update schedule - ensure all dates have the brush at index 0, add glue ID
    setSchedule(prev => {
      const updated = { ...prev }
      selectedDates.forEach(dateStr => {
        const day = updated[dateStr] || { date: dateStr, brushes: [] }
        // Remove ALL occurrences of this brush so we never have duplicate (merged + full block)
        let updatedBrushes = day.brushes.filter(id => id !== brushId)
        const updatedBrushGlueIds = { ...day.brushGlueIds || {} }
        const updatedCustomLabels = { ...day.customLabels || {} }
        
        // Rebuild glue/labels for remaining brushes (indices shift when we remove brushId)
        const otherBrushGlueIds: Record<number, string> = {}
        const otherCustomLabels: Record<number, string> = {}
        day.brushes.forEach((id, idx) => {
          if (id !== brushId) {
            const newIdx = Object.keys(otherBrushGlueIds).length
            if (updatedBrushGlueIds[idx] !== undefined) otherBrushGlueIds[newIdx] = updatedBrushGlueIds[idx]
            if (updatedCustomLabels[idx] !== undefined) otherCustomLabels[newIdx] = updatedCustomLabels[idx]
          }
        })
        
        // Insert brush once at targetBrushIndex (after existing merged blocks)
        const insertAt = Math.min(targetBrushIndex, updatedBrushes.length)
        updatedBrushes.splice(insertAt, 0, brushId)
        
        // Shift other glue/labels for indices >= insertAt
        const shiftedBrushGlueIds: Record<number, string> = {}
        const shiftedCustomLabels: Record<number, string> = {}
        Object.keys(otherBrushGlueIds).forEach(key => {
          const idx = parseInt(key)
          if (idx >= insertAt) {
            shiftedBrushGlueIds[idx + 1] = otherBrushGlueIds[idx]
          } else {
            shiftedBrushGlueIds[idx] = otherBrushGlueIds[idx]
          }
        })
        Object.keys(otherCustomLabels).forEach(key => {
          const idx = parseInt(key)
          if (idx >= insertAt) {
            shiftedCustomLabels[idx + 1] = otherCustomLabels[idx]
          } else {
            shiftedCustomLabels[idx] = otherCustomLabels[idx]
          }
        })
        // Assign merge glue ID at the actual index where we inserted the brush
        shiftedBrushGlueIds[insertAt] = glueGroupId
        // Preserve label from any previous occurrence (use first found)
        const prevIdx = day.brushes.indexOf(brushId)
        if (prevIdx !== -1 && updatedCustomLabels[prevIdx] !== undefined) {
          shiftedCustomLabels[insertAt] = updatedCustomLabels[prevIdx]
        }
        
        updated[dateStr] = {
          ...day,
          brushes: updatedBrushes,
          brushGlueIds: Object.keys(shiftedBrushGlueIds).length > 0 ? shiftedBrushGlueIds : undefined,
          customLabels: Object.keys(shiftedCustomLabels).length > 0 ? shiftedCustomLabels : undefined,
        }
      })
      return updated
    })
    
    setPendingMergeDates([])
    setPendingMergeSelections([])
    setPendingMergeBrushId(null)
    setPendingMergeBrushIndex(null)
    setIsMergeMode(false)
    setHasUnsavedChanges(true)
  }, [pendingMergeSelections, pendingMergeBrushId, areConsecutiveDates, getScheduleDay, saveToHistory])

  // Handle unmerge - removes a merged glue group
  const handleUnmergeClick = useCallback((date: Date) => {
    if (!isUnmergeMode) return
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const day = getScheduleDay(dateStr)
    
    if (day.brushes.length === 0) return
    
    // Check if this date has a merged glue ID
    const brushGlueIds = day.brushGlueIds || {}
    let glueIdToUnmerge: string | null = null
    let brushIndexToUnmerge: number | null = null
    
    // Find the first brush index that has a merged glue ID
    for (let i = 0; i < day.brushes.length; i++) {
      const gId = brushGlueIds[i]
      if (gId && mergeGlueGroups.has(gId)) {
        glueIdToUnmerge = gId
        brushIndexToUnmerge = i
        break
      }
    }
    
    if (!glueIdToUnmerge) {
      // No merged glue found on this date
      return
    }
    
    saveToHistory()
    
    // Get all dates in this merged glue group
    const glueGroup = glueGroups[glueIdToUnmerge]
    if (!glueGroup) return
    
    // Remove the glue ID from mergeGlueGroups
    setMergeGlueGroups(prev => {
      const updated = new Set(prev)
      updated.delete(glueIdToUnmerge!)
      return updated
    })
    
    // Remove glue IDs from all dates in the group
    setSchedule(prev => {
      const updated = { ...prev }
      glueGroup.dates.forEach(d => {
        const day = updated[d] || { date: d, brushes: [] }
        const updatedBrushGlueIds = { ...day.brushGlueIds || {} }
        
        // Remove the glue ID from all brush indices that have it
        Object.keys(updatedBrushGlueIds).forEach(key => {
          const idx = parseInt(key)
          if (updatedBrushGlueIds[idx] === glueIdToUnmerge) {
            delete updatedBrushGlueIds[idx]
          }
        })
        
        updated[d] = {
          ...day,
          brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
        }
      })
      return updated
    })
    
    // Remove the glue group
    setGlueGroups(prev => {
      const updated = { ...prev }
      delete updated[glueIdToUnmerge!]
      return updated
    })
    
    setHasUnsavedChanges(true)
  }, [isUnmergeMode, getScheduleDay, mergeGlueGroups, glueGroups, saveToHistory])

  // Add brush to a date (handles horizontal splitting)
  const addBrushToDate = useCallback((dateStr: string, brushId: string) => {
    saveToHistory() // Save state before modification
    setSchedule(prev => {
      const day = prev[dateStr] || { date: dateStr, brushes: [] }
      const updatedBrushes = [...day.brushes]
      const brushGlueIds = { ...day.brushGlueIds || {} }
      
      // If not in glue mode, remove non-merged glue links (but preserve merged ones)
      const shouldRemoveGlue = !isGlueMode
      
      // If brush already exists, remove it (toggle behavior)
      if (updatedBrushes.includes(brushId)) {
        const brushIndex = updatedBrushes.indexOf(brushId)
        const filtered = updatedBrushes.filter(id => id !== brushId)
        
        // Remove the brush's glue ID if it exists and is not merged
        const glueIdToRemove = brushGlueIds[brushIndex]
        const isMergedGlue = glueIdToRemove && mergeGlueGroups.has(glueIdToRemove)
        
        // Shift glue IDs down for brushes after the removed one
        const updatedBrushGlueIds: Record<number, string> = {}
        Object.keys(brushGlueIds).forEach(key => {
          const idx = parseInt(key)
          if (idx < brushIndex) {
            updatedBrushGlueIds[idx] = brushGlueIds[idx]
          } else if (idx > brushIndex) {
            updatedBrushGlueIds[idx - 1] = brushGlueIds[idx]
          }
          // Skip the removed brush's index
        })
        
        // If not in glue mode, remove non-merged glue IDs
        if (shouldRemoveGlue) {
          Object.keys(updatedBrushGlueIds).forEach(key => {
            const idx = parseInt(key)
            const gId = updatedBrushGlueIds[idx]
            if (gId && !mergeGlueGroups.has(gId)) {
              delete updatedBrushGlueIds[idx]
            }
          })
        }
        
        return {
          ...prev,
          [dateStr]: {
            ...day,
            brushes: filtered,
            brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
          },
        }
      } else {
        // Add brush to the array (will be rendered as horizontal stripe)
        // If there are merged stripes, add after them (to non-merged section)
        // Otherwise, just append
        const hasMergedStripes = Object.keys(brushGlueIds).some(idx => {
          const gId = brushGlueIds[parseInt(idx)]
          return gId && mergeGlueGroups.has(gId)
        })
        
        let insertIndex = updatedBrushes.length
        if (hasMergedStripes) {
          // Find the first non-merged index (after all merged stripes)
          const mergedIndices = Object.keys(brushGlueIds)
            .map(idx => parseInt(idx))
            .filter(idx => {
              const gId = brushGlueIds[idx]
              return gId && mergeGlueGroups.has(gId)
            })
            .sort((a, b) => a - b)
          
          if (mergedIndices.length > 0) {
            // Insert after the last merged stripe
            insertIndex = Math.max(...mergedIndices) + 1
          }
        }
        
        updatedBrushes.splice(insertIndex, 0, brushId)
        
        // Shift glue IDs for brushes after the insertion point
        const updatedBrushGlueIds: Record<number, string> = {}
        Object.keys(brushGlueIds).forEach(key => {
          const idx = parseInt(key)
          if (idx < insertIndex) {
            updatedBrushGlueIds[idx] = brushGlueIds[idx]
          } else {
            updatedBrushGlueIds[idx + 1] = brushGlueIds[idx]
          }
        })
        
        // If not in glue mode, remove non-merged glue IDs (but preserve merged ones)
        if (shouldRemoveGlue) {
          Object.keys(updatedBrushGlueIds).forEach(key => {
            const idx = parseInt(key)
            const gId = updatedBrushGlueIds[idx]
            if (gId && !mergeGlueGroups.has(gId)) {
              delete updatedBrushGlueIds[idx]
            }
          })
        }
        
        return {
          ...prev,
          [dateStr]: {
            ...day,
            brushes: updatedBrushes,
            brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
          },
        }
      }
    })
    setHasUnsavedChanges(true)
  }, [isGlueMode, mergeGlueGroups])

  // Paint multiple dates (for drag)
  const paintDateRange = useCallback((startDateStr: string, endDateStr: string, brushId: string) => {
    saveToHistory() // Save state before modification
    const start = new Date(startDateStr)
    const end = new Date(endDateStr)
    const minDate = new Date(Math.min(start.getTime(), end.getTime()))
    const maxDate = new Date(Math.max(start.getTime(), end.getTime()))
    
    const datesToPaint: string[] = []
    for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      datesToPaint.push(format(d, 'yyyy-MM-dd'))
    }
    
    // If not in glue mode, remove all glue links from painted dates
    const shouldRemoveGlue = !isGlueMode
    
    setSchedule(prev => {
      const updatedSchedule = { ...prev }
      datesToPaint.forEach(dateStr => {
        const day = prev[dateStr] || { date: dateStr, brushes: [] }
        const updatedBrushes = [...day.brushes]
        if (!updatedBrushes.includes(brushId)) {
          updatedBrushes.push(brushId)
        }
        updatedSchedule[dateStr] = {
          ...day,
          brushes: updatedBrushes,
          // Remove glue links when not in glue mode
          brushGlueIds: shouldRemoveGlue ? undefined : day.brushGlueIds,
        }
      })
      return updatedSchedule
    })
    setHasUnsavedChanges(true)
  }, [isGlueMode])

  // Helper function to get next valid date (skipping weekends if sabbathMode is true)
  const getNextValidDate = useCallback((date: Date, direction: 'forward' | 'backward' = 'forward'): Date => {
    const newDate = new Date(date)
    if (!sabbathMode) {
      // Sabbath mode OFF - allow weekends
      return newDate
    }
    
    // Sabbath mode ON - skip weekends (Saturday = 6, Sunday = 0)
    // Always move forward to next weekday to ensure dates never land on weekends
    let dayOfWeek = newDate.getDay()
    while (dayOfWeek === 0 || dayOfWeek === 6) {
      // Always move forward in sabbath mode to skip weekends
      newDate.setDate(newDate.getDate() + 1)
      dayOfWeek = newDate.getDay()
    }
    return newDate
  }, [sabbathMode])
  
  // Helper function to ensure a date is never on a weekend when sabbath mode is ON
  const ensureWeekday = useCallback((date: Date): Date => {
    if (!sabbathMode) {
      return date
    }
    
    const newDate = new Date(date)
    let dayOfWeek = newDate.getDay()
    // If it's a weekend, move forward to next weekday
    while (dayOfWeek === 0 || dayOfWeek === 6) {
      newDate.setDate(newDate.getDate() + 1)
      dayOfWeek = newDate.getDay()
    }
    return newDate
  }, [sabbathMode])

  // Handle mouse down on a specific brush stripe
  const handleStripeMouseDown = useCallback((dateStr: string, brushIndex: number, e: React.MouseEvent) => {
    const day = schedule[dateStr]
    if (!day?.brushes || brushIndex >= day.brushes.length) return
    
    e.preventDefault()
    e.stopPropagation()
    
    // Merged dates are now just permanent glue groups, so they'll be handled by the glue logic below
    
    const brushGlueIds = day.brushGlueIds || {}
    const glueId = brushGlueIds[brushIndex]
    
    // Check if the clicked stripe is merged
    const isMergedStripe = glueId && mergeGlueGroups.has(glueId)
    
    // If this stripe is glued, find ALL glued stripes in the same date box AND all other dates with the same glue ID
    let sourceBrushIndices: number[] = []
    let sourceBrushes: string[] = []
    let sourceBrushGlueIds: Record<number, string> = {}
    let connectedDates: Array<{ dateStr: string; brushIndex: number; brushId: string }> = []
    
    if (glueId) {
      // Find ALL dates that have this same glue ID (smart calendar mover)
      // CRITICAL: Only include dates with the SAME glue ID (don't mix merged and non-merged)
      Object.keys(schedule).forEach(otherDateStr => {
        const otherDay = schedule[otherDateStr]
        if (otherDay?.brushGlueIds) {
          Object.keys(otherDay.brushGlueIds).forEach(key => {
            const otherBrushIndex = parseInt(key)
            const otherGlueId = otherDay.brushGlueIds![otherBrushIndex]
            
            // Only include if it's the same glue ID
            if (otherGlueId === glueId) {
              // Check if this brush index has a brush - if not, use the brush from the source date
              const otherBrushId = otherBrushIndex < otherDay.brushes.length 
                ? otherDay.brushes[otherBrushIndex] 
                : day.brushes[brushIndex] // Fallback to source brush if target doesn't have one yet
              
              // Only add if not already added (avoid duplicates)
              if (!connectedDates.find(cd => cd.dateStr === otherDateStr && cd.brushIndex === otherBrushIndex)) {
                connectedDates.push({
                  dateStr: otherDateStr,
                  brushIndex: otherBrushIndex,
                  brushId: otherBrushId, // Use the brush ID (from target if exists, else from source)
                })
              }
            }
          })
        }
      })
      
      // Do NOT add from mergedGroup.dates with source brushIndex: each date can have this glueId at a different index.
      // The loop above already added every (dateStr, brushIndex) that has this glueId, so we only move the block we touched.
      
      // Sort connected dates by date to maintain order
      connectedDates.sort((a, b) => {
        return new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime()
      })
      
      // For the source date, find ALL glued stripes with the SAME glue ID
      // CRITICAL: If clicking a non-merged stripe, only include non-merged stripes
      // If clicking a merged stripe, only include merged stripes
      const sortedIndices = Object.keys(brushGlueIds)
        .map(key => parseInt(key))
        .filter(idx => {
          if (idx >= day.brushes.length) return false
          const idxGlueId = brushGlueIds[idx]
          if (!idxGlueId) return false
          
          // If clicking a merged stripe, only include merged stripes
          // If clicking a non-merged stripe, only include non-merged stripes with the same glue ID
          if (isMergedStripe) {
            return mergeGlueGroups.has(idxGlueId) && idxGlueId === glueId
          } else {
            return !mergeGlueGroups.has(idxGlueId) && idxGlueId === glueId
          }
        })
        .sort((a, b) => a - b)
      
      // If no matching stripes found (shouldn't happen), just use the clicked one
      if (sortedIndices.length === 0) {
        sortedIndices.push(brushIndex)
      }
      
      sortedIndices.forEach(idx => {
        sourceBrushIndices.push(idx)
        sourceBrushes.push(day.brushes[idx])
        sourceBrushGlueIds[idx] = brushGlueIds[idx]
      })
    } else if (Object.keys(brushGlueIds).length > 0) {
      // If clicked stripe isn't glued but others in this date are, just drag this one
      // But exclude merged stripes - they should stay in place
      sourceBrushIndices = [brushIndex]
      sourceBrushes = [day.brushes[brushIndex]]
      sourceBrushGlueIds = {}
    } else {
      // If not glued, just drag this one stripe
      sourceBrushIndices = [brushIndex]
      sourceBrushes = [day.brushes[brushIndex]]
      sourceBrushGlueIds = {}
    }
    
    // Clear any existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
    }
    
    dragState.current = {
      isDragging: false, // Will be set to true after hold time
      startDate: dateStr,
      isGlueDrag: true,
      glueGroupId: glueId || null,
      mouseMoved: false,
      lastGlueDragDate: null,
      sourceBrushes: sourceBrushes, // All glued brushes from this date
      sourceBrushIndex: brushIndex, // Track which brush was clicked (for visual feedback)
      sourceBrushIndices: sourceBrushIndices, // All brush indices being dragged
      sourceBrushGlueIds: sourceBrushGlueIds, // Glue IDs for each brush being moved
      connectedDates: connectedDates.length > 0 ? connectedDates : null, // All dates connected via same glue ID
      sourceDateStr: dateStr, // The original date being dragged
      dragStartTime: Date.now(),
      mouseX: e.clientX,
      mouseY: e.clientY,
      isHolding: true,
    }
    
    // Set a timer to start dragging after a short hold
    dragTimeoutRef.current = setTimeout(() => {
      if (dragState.current.startDate === dateStr && dragState.current.dragStartTime && dragState.current.sourceBrushIndex === brushIndex) {
        dragState.current.isDragging = true
        dragState.current.isHolding = false
        setIsDraggingState(true) // Trigger re-render
        // Change cursor to indicate dragging
        document.body.style.cursor = 'grabbing'
      }
    }, 150) // 150ms hold time
  }, [schedule])

  // Handle mouse down - only for drag operations
  const handleMouseDown = useCallback((date: Date, e: React.MouseEvent) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const day = schedule[dateStr]
    
    e.preventDefault()
    
    // In glue mode, if clicking on a colored date (has brushes), prepare for drag-and-drop
    // But only if not clicking on a specific stripe (stripe handler will take precedence)
    if (isGlueMode && day?.brushes && day.brushes.length > 0) {
      // Check if click was on a stripe (stripe handler will handle it)
      const target = e.target as HTMLElement
      if (target.closest('[data-brush-index]')) {
        return // Let stripe handler deal with it
      }
      
      // If clicking on the date box but not a stripe, use first brush as default
      // Clear any existing timeout
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current)
      }
      
      dragState.current = {
        isDragging: false, // Will be set to true after hold time
        startDate: dateStr,
        isGlueDrag: true,
        glueGroupId: day.glueId || null,
        mouseMoved: false,
        lastGlueDragDate: null,
        sourceBrushes: [day.brushes[0]], // Default to first brush
        sourceBrushIndex: 0, // Default to first brush
        sourceBrushIndices: null,
        sourceBrushGlueIds: null,
        connectedDates: null,
        sourceDateStr: dateStr,
        dragStartTime: Date.now(),
        mouseX: e.clientX,
        mouseY: e.clientY,
        isHolding: true,
      }
      
      // Set a timer to start dragging after a short hold
      dragTimeoutRef.current = setTimeout(() => {
        if (dragState.current.startDate === dateStr && dragState.current.dragStartTime) {
          dragState.current.isDragging = true
          dragState.current.isHolding = false
          setIsDraggingState(true) // Trigger re-render
          // Change cursor to indicate dragging
          document.body.style.cursor = 'grabbing'
        }
      }, 150) // 150ms hold time
      return
    }
    
    // If date is glued (has glueId and brushes), allow dragging it (existing behavior)
    if (day?.glueId && day.brushes.length > 0) {
      // Start glue drag - drag this glued tile (or group)
      dragState.current = {
        isDragging: true,
        startDate: dateStr,
        isGlueDrag: true,
        glueGroupId: day.glueId,
        mouseMoved: false,
        lastGlueDragDate: null,
        sourceBrushes: null,
        sourceBrushIndex: null,
        sourceBrushIndices: null,
        sourceBrushGlueIds: null,
        connectedDates: null,
        sourceDateStr: dateStr,
        dragStartTime: null,
        mouseX: null,
        mouseY: null,
        isHolding: false,
      }
      return
    }
    
    // Start paint drag - but don't paint yet, wait for mouse move
    if (selectedBrush && !isGlueMode) {
      dragState.current = {
        isDragging: true,
        startDate: dateStr,
        isGlueDrag: false,
        glueGroupId: null,
        mouseMoved: false,
        lastGlueDragDate: null,
        sourceBrushes: null,
        sourceBrushIndex: null,
        sourceBrushIndices: null,
        sourceBrushGlueIds: null,
        connectedDates: null,
        sourceDateStr: dateStr,
        dragStartTime: null,
        mouseX: null,
        mouseY: null,
        isHolding: false,
      }
    }
  }, [selectedBrush, isGlueMode, schedule, handleStripeMouseDown])

  // Track mouse movement for drag preview
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.current.isDragging && dragState.current.sourceBrushes) {
        dragState.current.mouseX = e.clientX
        dragState.current.mouseY = e.clientY
        // Update state to trigger re-render for drag preview
        setDragPreviewPos({ x: e.clientX, y: e.clientY })
      } else if (dragState.current.isHolding) {
        // Update position even during hold phase
        dragState.current.mouseX = e.clientX
        dragState.current.mouseY = e.clientY
      }
    }
    
    // Always listen, but only update preview when dragging
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])
  
  // Clear preview when drag ends
  useEffect(() => {
    if (!dragState.current.isDragging && !dragState.current.isHolding) {
      setDragPreviewPos(null)
    }
  })

  // Handle mouse enter (during drag) - only for drag operations
  const handleMouseEnter = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    // In glue mode, if we're holding or dragging with source brushes (move mode), track the target
    // CRITICAL: Check both isDragging AND isHolding to catch drags early
    if (isGlueMode && dragState.current.isGlueDrag && dragState.current.sourceBrushes && dragState.current.sourceBrushes.length > 0 && (dragState.current.isDragging || dragState.current.isHolding)) {
      if (dragState.current.startDate && dragState.current.startDate !== dateStr) {
        dragState.current.mouseMoved = true
        // If we're holding but not yet dragging, start dragging now
        if (dragState.current.isHolding && !dragState.current.isDragging) {
          dragState.current.isDragging = true
          dragState.current.isHolding = false
          setIsDraggingState(true)
        }
        // Update cursor to show we can drop
        document.body.style.cursor = 'grabbing'
      }
      // Visual feedback will be handled in render via className
      return
    }
    
    // For other drag modes, mark mouse moved if we entered a different date
    if (dragState.current.startDate && dragState.current.startDate !== dateStr) {
      dragState.current.mouseMoved = true
      // If we're holding but not yet dragging, start dragging now
      if (dragState.current.isHolding && !dragState.current.isDragging) {
        dragState.current.isDragging = true
        dragState.current.isHolding = false
        setIsDraggingState(true)
      }
    }
    
    if (!dragState.current.isDragging && !dragState.current.isHolding) return
    
    if (dragState.current.isGlueDrag && dragState.current.glueGroupId) {
      // Get the target date (skip weekends if sabbathMode is true)
      let targetDate = new Date(date)
      if (sabbathMode) {
        targetDate = getNextValidDate(targetDate)
      }
      const targetDateStr = format(targetDate, 'yyyy-MM-dd')
      
      // Only update if we moved to a different date
      if (dragState.current.lastGlueDragDate === targetDateStr) {
        return
      }
      dragState.current.lastGlueDragDate = targetDateStr
      
      // Handle glue drag - move entire group maintaining relative spacing
      setGlueGroups(prev => {
        const glueGroup = prev[dragState.current.glueGroupId!]
        if (!glueGroup || !dragState.current.startDate) return prev
        
        // Get the original start date (the one being dragged)
        const startDateStr = dragState.current.startDate
        const originalStartDate = new Date(startDateStr)
        
        // Calculate the offset (difference in days)
        const offsetDays = Math.round((targetDate.getTime() - originalStartDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // Sort original dates to maintain order
        const sortedOriginalDates = [...glueGroup.dates].sort((a, b) => {
          return new Date(a).getTime() - new Date(b).getTime()
        })
        
        // Calculate new dates by applying offset to each date, maintaining relative spacing
        // This works like a snake - all dates move together maintaining their relative positions
        const newDates: string[] = []
        sortedOriginalDates.forEach((oldDateStr, idx) => {
          const oldDate = new Date(oldDateStr)
          const newDate = new Date(oldDate)
          newDate.setDate(newDate.getDate() + offsetDays)
          
          // Skip weekends if sabbathMode is false
          if (!sabbathMode) {
            // For the first date, we already adjusted targetDate
            if (idx === 0) {
              newDates.push(targetDateStr)
            } else {
          // For subsequent dates, calculate the gap from the previous date
          const prevOldDate = new Date(sortedOriginalDates[idx - 1])
          const daysBetween = Math.round((oldDate.getTime() - prevOldDate.getTime()) / (1000 * 60 * 60 * 24))
          
          // Apply the same gap from the previous new date
          const prevNewDate = new Date(newDates[idx - 1])
          prevNewDate.setDate(prevNewDate.getDate() + daysBetween)
          if (sabbathMode) {
            const adjustedDate = getNextValidDate(prevNewDate)
            newDates.push(format(adjustedDate, 'yyyy-MM-dd'))
          } else {
            newDates.push(format(prevNewDate, 'yyyy-MM-dd'))
          }
        }
      } else {
        newDates.push(format(newDate, 'yyyy-MM-dd'))
      }
        })
        
        // Update schedule with moved dates - preserve all data
        // Use functional update to ensure we have the latest state
        // This works like a snake - all dates move together preserving all their data
        setSchedule(prevSchedule => {
          const updatedSchedule = { ...prevSchedule }
          
          // First, copy all the old data to new locations (preserve ALL brushes and data)
          sortedOriginalDates.forEach((oldDateStr, idx) => {
            const newDateStr = newDates[idx]
            const oldDay = prevSchedule[oldDateStr]
            
            if (oldDay) {
              // Copy the entire day data including ALL brushes (2, 3, 4, etc.)
              // This preserves dates with multiple colors/brushes
              updatedSchedule[newDateStr] = {
                ...oldDay,
                date: newDateStr,
                glueId: dragState.current.glueGroupId!, // Keep the glue ID
                brushes: Array.isArray(oldDay.brushes) ? [...oldDay.brushes] : oldDay.brushes, // Preserve all brushes
              }
            } else {
              // If old day doesn't exist, create a minimal entry
              updatedSchedule[newDateStr] = {
                date: newDateStr,
                brushes: [],
                glueId: dragState.current.glueGroupId!,
              }
            }
          })
          
          // Then, delete the old locations (only if they're not in the new locations)
          // This ensures we don't delete dates that are staying in place
          sortedOriginalDates.forEach((oldDateStr) => {
            if (!newDates.includes(oldDateStr)) {
              delete updatedSchedule[oldDateStr]
            }
          })
          
          return updatedSchedule
        })
        
        // Update the glue group with new dates
        return {
          ...prev,
          [dragState.current.glueGroupId!]: {
            ...glueGroup,
            dates: newDates,
          },
        }
      })
      setHasUnsavedChanges(true)
    } else if (dragState.current.startDate && selectedBrush && dragState.current.startDate !== dateStr) {
      // Paint drag - fill range (only if moved to different date)
      paintDateRange(dragState.current.startDate, dateStr, selectedBrush)
    }
  }, [selectedBrush, paintDateRange, getNextValidDate, sabbathMode])

  // Handle mouse up
  const handleMouseUp = useCallback((date?: Date) => {
    // Clear drag timeout if it exists
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
      dragTimeoutRef.current = null
    }
    
        // If we were just holding (before drag started), cancel it
        if (dragState.current.isHolding && !dragState.current.isDragging) {
          dragState.current = {
            isDragging: false,
            startDate: null,
            isGlueDrag: false,
            glueGroupId: null,
            mouseMoved: false,
            lastGlueDragDate: null,
            sourceBrushes: null,
            sourceBrushIndex: null,
            sourceBrushIndices: null,
            sourceBrushGlueIds: null,
            connectedDates: null,
            sourceDateStr: null,
            dragStartTime: null,
            mouseX: null,
            mouseY: null,
            isHolding: false,
          }
          setIsDraggingState(false)
          document.body.style.cursor = ''
          return
        }
    
    // More lenient drag detection: if we're in glue mode with source brushes and either:
    // 1. We dragged (mouseMoved) OR
    // 2. We're dropping on a different date (even if mouseMoved wasn't set)
    const sourceBrushes = dragState.current.sourceBrushes
    const startDate = dragState.current.startDate
    const isDifferentDate = date && startDate && format(date, 'yyyy-MM-dd') !== startDate
    const wasDragging = dragState.current.isDragging && (dragState.current.mouseMoved || isDifferentDate)
    
    // Reset cursor
    document.body.style.cursor = ''
    
    // If in glue mode and we have source brushes, MOVE them to the drop target (not copy)
    // Also handle if we were dragging but didn't get a date parameter - try to find it from mouse position
    // CRITICAL: Allow drop if we have source brushes and are dropping on a different date, even if mouseMoved wasn't set
    if (isGlueMode && dragState.current.isDragging && sourceBrushes && sourceBrushes.length > 0 && startDate && (wasDragging || isDifferentDate)) {
      // If no date provided, try to find it from the last known drag position
      let targetDate = date
      if (!targetDate && dragState.current.mouseX !== null && dragState.current.mouseY !== null) {
        // Try to find the element under the mouse
        const elementAtPoint = document.elementFromPoint(dragState.current.mouseX, dragState.current.mouseY)
        if (elementAtPoint) {
          const dateElement = elementAtPoint.closest('[data-date]') as HTMLElement
          if (dateElement) {
            const dateStr = dateElement.getAttribute('data-date')
            if (dateStr) {
              try {
                targetDate = new Date(dateStr)
                if (isNaN(targetDate.getTime())) {
                  targetDate = undefined
                }
              } catch {
                targetDate = undefined
              }
            }
          }
        }
      }
      
      if (targetDate) {
      const targetDateStr = format(targetDate, 'yyyy-MM-dd')
      const sourceDateStr = startDate
      const sourceBrushIndices = dragState.current.sourceBrushIndices || []
      const connectedDates = dragState.current.connectedDates || []
      const sourceDateStrForSpacing = dragState.current.sourceDateStr || sourceDateStr
      // Merged groups are now just permanent glue groups, so they use the same drag logic below
      // No special handling needed - the existing glue drag logic will handle them
      
      // Only move if dropping on a different date (or if we have multiple connected dates, allow moving even if same date to update positions)
      // For multiple connected dates, we want to allow repositioning even if the anchor date is the same
      const isDifferentDate = targetDateStr !== sourceDateStr
      const hasMultipleConnectedDates = connectedDates.length > 1
      if ((isDifferentDate || hasMultipleConnectedDates) && sourceBrushIndices.length > 0) {
        saveToHistory() // Save state before modification
        setSchedule(prev => {
          const updatedSchedule = { ...prev }
          
          // If we have connected dates (smart calendar mover), move all of them maintaining relative spacing
          // Only use smart mover if there are multiple dates connected (at least 2)
          if (connectedDates.length > 1) {
            // Determine which date to use as anchor:
            // Always use the clicked date (sourceDateStrForSpacing) as the anchor
            // This ensures the date you drag lands exactly where you drop it
            const sourceConnectedDate = connectedDates.find(cd => cd.dateStr === sourceDateStrForSpacing)
            const anchorDateStr = sourceConnectedDate?.dateStr || connectedDates[0].dateStr
            
            // Parse target date directly from string to avoid timezone issues
            const [targetYear, targetMonth, targetDay] = targetDateStr.split('-').map(Number)
            const targetDateObj = new Date(targetYear, targetMonth - 1, targetDay)
            targetDateObj.setHours(0, 0, 0, 0)
            
            // First, calculate the adjusted target date (anchor) - skip weekend if Sabbath mode is ON
            // The target date is where the user dropped - this should be where the anchor lands
            let adjustedTargetDateStr = targetDateStr
            let adjustedTargetDateObj = targetDateObj
            if (sabbathMode) {
              // Use helper function to ensure we never land on a weekend
              adjustedTargetDateObj = ensureWeekday(targetDateObj)
              adjustedTargetDateStr = format(adjustedTargetDateObj, 'yyyy-MM-dd')
            }
            
            // Parse the adjusted target date for calculations (parse directly to avoid timezone issues)
            // Use the adjusted date object if Sabbath mode is on, otherwise use the original target
            const dateToUse = sabbathMode ? adjustedTargetDateObj : targetDateObj
            const adjustedTargetYear = dateToUse.getFullYear()
            const adjustedTargetMonth = dateToUse.getMonth() + 1
            const adjustedTargetDay = dateToUse.getDate()
            
            // Parse anchor date for reference (parse directly to avoid timezone issues)
            const [anchorYear, anchorMonth, anchorDay] = anchorDateStr.split('-').map(Number)
            const anchorDateObj = new Date(anchorYear, anchorMonth - 1, anchorDay)
            anchorDateObj.setHours(0, 0, 0, 0)
            
            // First, collect all the data we need to move (before modifying the schedule)
            const movesToProcess: Array<{
              originalDateStr: string
              originalBrushIndex: number
              brushId: string
              glueId: string | undefined
              customLabel: string | undefined
              customColor: string | undefined
              newDateStr: string
            }> = []
            
            connectedDates.forEach(connectedDate => {
              // Parse dates more reliably by splitting the date string
              const [originalYear, originalMonth, originalDay] = connectedDate.dateStr.split('-').map(Number)
              const originalDateObj = new Date(originalYear, originalMonth - 1, originalDay)
              originalDateObj.setHours(0, 0, 0, 0)
              
              let newDateStr: string
              
              // If this is the anchor date, use the adjusted target date exactly
              if (connectedDate.dateStr === anchorDateStr) {
                newDateStr = adjustedTargetDateStr
              } else {
                // Calculate the offset from anchor to this date
                // Use a more reliable calculation that handles day differences correctly
                // Calculate difference in days by comparing date components directly
                const timeDiff = originalDateObj.getTime() - anchorDateObj.getTime()
                // Use Math.floor to ensure we get the correct day difference (not rounded)
                // This handles cases where times might be slightly different
                const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
                
                // Calculate new date based on sabbath mode
                // Create finalDate from the adjusted target date (where anchor will land)
                let finalDate = new Date(adjustedTargetYear, adjustedTargetMonth - 1, adjustedTargetDay)
                finalDate.setHours(0, 0, 0, 0)
                
                if (sabbathMode) {
                  // In Sabbath mode, calculate weekday offset and move by weekday count (skipping weekends)
                  const direction = daysDiff >= 0 ? 1 : -1
                  const absDays = Math.abs(daysDiff)
                  
                  // Count weekdays (skip weekends) in the direction from anchor to original
                  let weekdaysCounted = 0
                  
                  // Move day by day from anchor toward original, counting only weekdays
                  for (let i = 1; i <= absDays; i++) {
                    const checkDate = new Date(anchorDateObj)
                    checkDate.setDate(checkDate.getDate() + (direction * i))
                    const dayOfWeek = checkDate.getDay()
                    // Count only weekdays (Monday-Friday: 1-5)
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                      weekdaysCounted++
                    }
                  }
                  
                  const weekdayOffset = direction * weekdaysCounted
                  
                  // Move by the required number of weekdays, skipping weekends
                  let weekdaysToMove = Math.abs(weekdayOffset)
                  const moveDirection = weekdayOffset >= 0 ? 1 : -1
                  
                  // Move day by day, only counting weekdays
                  while (weekdaysToMove > 0) {
                    finalDate.setDate(finalDate.getDate() + moveDirection)
                    const dayOfWeek = finalDate.getDay()
                    // Only count weekdays (Monday-Friday: 1-5)
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                      weekdaysToMove--
                    }
                    // If we land on a weekend, keep moving (but don't count it)
                    // This ensures we skip over weekends automatically
                  }
                  
                  // Final safety check: ensure we NEVER land on a weekend in Sabbath mode
                  // Use the helper function to guarantee we're on a weekday
                  finalDate = ensureWeekday(finalDate)
                } else {
                  // Sabbath mode OFF: use calendar day offset (allow weekends)
                  // Use the original target date directly, not the adjusted one
                  // Calculate the new date by adding the day difference to the target date
                  finalDate = new Date(targetDateObj)
                  finalDate.setDate(finalDate.getDate() + daysDiff)
                  finalDate.setHours(0, 0, 0, 0) // Ensure it's at midnight
                }
                
                // Format the final date string - use direct date components to avoid timezone issues
                newDateStr = format(finalDate, 'yyyy-MM-dd')
              }
              
              // CRITICAL: Use the brushId from connectedDate (captured at drag start)
              // This ensures we have the correct brush even if the schedule state changes
              const connectedDay = prev[connectedDate.dateStr]
              let brushIdToUse = connectedDate.brushId // Always use the brush ID captured at drag start
              
              // If brushId is missing from connectedDate, try to get it from the schedule
              if (!brushIdToUse && connectedDay && connectedDate.brushIndex < connectedDay.brushes.length) {
                brushIdToUse = connectedDay.brushes[connectedDate.brushIndex]
              }
              
              // If still missing, use the source brush as fallback (for merged blocks)
              const sourceDay = prev[sourceDateStr]
              if (!brushIdToUse && sourceDay?.brushes[connectedDate.brushIndex]) {
                brushIdToUse = sourceDay.brushes[connectedDate.brushIndex]
              }
              
              const glueId = connectedDay?.brushGlueIds?.[connectedDate.brushIndex]
              const customLabel = connectedDay?.customLabels?.[connectedDate.brushIndex]
              const customColor = connectedDay?.customColors?.[connectedDate.brushIndex]
              
              // ALWAYS add to moves if it's a different date OR if it has a glue ID (merged block)
              // This ensures Sunday and all other dates in merged blocks are always processed
              // CRITICAL: For merged blocks, we MUST process all dates, even if same date, to preserve brushes
              // Also process if we have a brushId (even if same date) to ensure brushes are preserved
              if (newDateStr !== connectedDate.dateStr) {
                // Different date - always move
                if (brushIdToUse) {
                  movesToProcess.push({
                    originalDateStr: connectedDate.dateStr,
                    originalBrushIndex: connectedDate.brushIndex,
                    brushId: brushIdToUse,
                    glueId,
                    customLabel,
                    customColor,
                    newDateStr,
                  })
                }
              } else if (glueId && brushIdToUse) {
                // Same date but has glue ID (merged block) - still process to ensure brush is preserved
                movesToProcess.push({
                  originalDateStr: connectedDate.dateStr,
                  originalBrushIndex: connectedDate.brushIndex,
                  brushId: brushIdToUse,
                  glueId,
                  customLabel,
                  customColor,
                  newDateStr,
                })
              }
            })
            
            // Process moves in two phases: first remove from source, then add to target
            // This prevents conflicts when multiple dates map to the same target
            
            // Phase 1: Remove brushes from source dates
            // Process in reverse chronological order to avoid index shifting issues
            const sortedMovesForRemoval = [...movesToProcess].sort((a, b) => {
              // Sort by date descending, then by index descending
              const dateCompare = new Date(b.originalDateStr).getTime() - new Date(a.originalDateStr).getTime()
              if (dateCompare !== 0) return dateCompare
              return b.originalBrushIndex - a.originalBrushIndex
            })
            
            // Track which (dateStr, brushIndex) we've already removed so we only do it once per specific index
            const removedIndices = new Set<string>()
            sortedMovesForRemoval.forEach(move => {
              const sourceDay = updatedSchedule[move.originalDateStr]
              if (!sourceDay) return
              const removeKey = `${move.originalDateStr}:${move.originalBrushIndex}`
              // Remove by specific brush index (not by brush ID) to avoid removing unintended brushes
              if (removedIndices.has(removeKey)) return
              removedIndices.add(removeKey)
              
              // Only remove if the index is valid and matches what we expect
              if (move.originalBrushIndex >= sourceDay.brushes.length) return
              
              const updatedBrushes: string[] = []
              const updatedBrushGlueIds: Record<number, string> = {}
              const updatedCustomLabels: Record<number, string> = {}
              const updatedCustomColors: Record<number, string> = {}
              sourceDay.brushes.forEach((id, idx) => {
                if (idx !== move.originalBrushIndex) {
                  const newIdx = updatedBrushes.length
                  updatedBrushes.push(id)
                  if (sourceDay.brushGlueIds?.[idx] !== undefined) updatedBrushGlueIds[newIdx] = sourceDay.brushGlueIds![idx]
                  if (sourceDay.customLabels?.[idx] !== undefined) updatedCustomLabels[newIdx] = sourceDay.customLabels![idx]
                  if (sourceDay.customColors?.[idx] !== undefined) updatedCustomColors[newIdx] = sourceDay.customColors![idx]
                }
              })
              
              if (updatedBrushes.length === sourceDay.brushes.length) return // nothing to remove
              
              updatedSchedule[move.originalDateStr] = {
                ...sourceDay,
                brushes: updatedBrushes,
                brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
                customLabels: Object.keys(updatedCustomLabels).length > 0 ? updatedCustomLabels : undefined,
                customColors: Object.keys(updatedCustomColors).length > 0 ? updatedCustomColors : undefined,
              }
            })
            
            // Phase 2: Add brushes to target dates (group by target date to maintain order)
            const movesByTarget = new Map<string, typeof movesToProcess>()
            movesToProcess.forEach(move => {
              if (!movesByTarget.has(move.newDateStr)) {
                movesByTarget.set(move.newDateStr, [])
              }
              movesByTarget.get(move.newDateStr)!.push(move)
            })
            
            // Process each target date
            movesByTarget.forEach((moves, targetDateStr) => {
              // Get the fresh state after removals (Phase 1)
              const targetDay = updatedSchedule[targetDateStr] || { date: targetDateStr, brushes: [] }
              const targetBrushes = [...targetDay.brushes]
              const targetBrushGlueIds = { ...targetDay.brushGlueIds || {} }
              const targetCustomLabels = { ...targetDay.customLabels || {} }
              const targetCustomColors = { ...targetDay.customColors || {} }
              
              // Add all brushes for this target date, maintaining the order they were in originally
              // Sort moves by original date to maintain chronological order
              const sortedMoves = [...moves].sort((a, b) => {
                return new Date(a.originalDateStr).getTime() - new Date(b.originalDateStr).getTime()
              })
              
              sortedMoves.forEach((move) => {
                // Add the brush to the target date
                // Note: We allow the same brushId to be added multiple times if it's from different source dates
                // This handles cases where multiple dates have the same brush but should all be preserved
                const newIndex = targetBrushes.length
                
                // CRITICAL: Always add the brush - this is critical for merged blocks
                // If brushId is missing, try multiple fallbacks to find it
                let brushIdToAdd = move.brushId
                
                // Fallback 1: Try to get it from the source date (before removal)
                if (!brushIdToAdd && move.glueId) {
                  // Check if we can find it from any other move that has the same glue ID
                  const otherMoveWithBrush = movesToProcess.find(m => 
                    m.glueId === move.glueId && m.brushId && m.brushId.trim() !== ''
                  )
                  if (otherMoveWithBrush) {
                    brushIdToAdd = otherMoveWithBrush.brushId
                  }
                }
                
                // Fallback 2: Try to get it from the source date in updatedSchedule
                if (!brushIdToAdd && move.glueId) {
                  const sourceDay = updatedSchedule[move.originalDateStr]
                  if (sourceDay && move.originalBrushIndex < sourceDay.brushes.length) {
                    brushIdToAdd = sourceDay.brushes[move.originalBrushIndex]
                  }
                }
                
                // CRITICAL: If we have a glue ID (merged block), we MUST have a brush
                // If we still don't have one, this is an error - but try to find it from the merged group
                if (!brushIdToAdd && move.glueId && mergeGlueGroups.has(move.glueId)) {
                  // For merged blocks, find the brush from any date in the merged group
                  const mergedGroup = glueGroups[move.glueId]
                  if (mergedGroup) {
                    // Try to find a brush from any date in the merged group
                    for (const dateStr of mergedGroup.dates) {
                      const day = updatedSchedule[dateStr] || prev[dateStr]
                      if (day && day.brushes && day.brushes.length > 0) {
                        brushIdToAdd = day.brushes[0] // Use first brush as fallback
                        break
                      }
                    }
                  }
                }
                
                // Always add the brush if we have one
                if (brushIdToAdd && brushIdToAdd.trim() !== '') {
                  targetBrushes.push(brushIdToAdd)
                  
                  // Preserve the glue ID (including merged glue IDs)
                  if (move.glueId) {
                    targetBrushGlueIds[newIndex] = move.glueId
                  }
                  
                  // Preserve the custom label
                  if (move.customLabel) {
                    targetCustomLabels[newIndex] = move.customLabel
                  }
                  
                  // Preserve the custom color
                  if (move.customColor) {
                    targetCustomColors[newIndex] = move.customColor
                  }
                } else if (move.glueId) {
                  // This should not happen, but log it for debugging
                  console.error(`CRITICAL: Missing brush ID for date ${move.newDateStr} with glue ID ${move.glueId}. Original: ${move.originalDateStr}, Index: ${move.originalBrushIndex}`)
                }
              })
              
              updatedSchedule[targetDateStr] = {
                ...targetDay,
                brushes: targetBrushes,
                brushGlueIds: Object.keys(targetBrushGlueIds).length > 0 ? targetBrushGlueIds : undefined,
                customLabels: Object.keys(targetCustomLabels).length > 0 ? targetCustomLabels : undefined,
                customColors: Object.keys(targetCustomColors).length > 0 ? targetCustomColors : undefined,
              }
            })
            
            // Return early - we've handled all connected dates
            return updatedSchedule
          }
          
          // Original logic for single date drag (if no connected dates)
          // Remove by specific brush indices (not by brush ID) to avoid removing unintended brushes
          const sourceDay = prev[sourceDateStr]
          if (sourceDay) {
            const indicesToRemove = new Set(sourceBrushIndices)
            const updatedBrushes: string[] = []
            const updatedBrushGlueIds: Record<number, string> = {}
            const updatedCustomLabels: Record<number, string> = {}
            const updatedCustomColors: Record<number, string> = {}
            sourceDay.brushes.forEach((id, idx) => {
              if (!indicesToRemove.has(idx)) {
                const newIdx = updatedBrushes.length
                updatedBrushes.push(id)
                if (sourceDay.brushGlueIds?.[idx] !== undefined) updatedBrushGlueIds[newIdx] = sourceDay.brushGlueIds[idx]
                if (sourceDay.customLabels?.[idx] !== undefined) updatedCustomLabels[newIdx] = sourceDay.customLabels[idx]
                if (sourceDay.customColors?.[idx] !== undefined) updatedCustomColors[newIdx] = sourceDay.customColors[idx]
              }
            })
            updatedSchedule[sourceDateStr] = {
              ...sourceDay,
              brushes: updatedBrushes,
              brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
              customLabels: Object.keys(updatedCustomLabels).length > 0 ? updatedCustomLabels : undefined,
              customColors: Object.keys(updatedCustomColors).length > 0 ? updatedCustomColors : undefined,
            }
          }
          
          // Add all brushes to target date
          const targetDay = prev[targetDateStr] || { date: targetDateStr, brushes: [] }
          
          // Preserve glue IDs, custom labels, and custom colors for all moved brushes
          const targetBrushGlueIds = { ...targetDay.brushGlueIds || {} }
          const targetCustomLabels = { ...targetDay.customLabels || {} }
          const targetCustomColors = { ...targetDay.customColors || {} }
          const sourceBrushGlueIds = dragState.current.sourceBrushGlueIds || {}
          const sourceCustomLabels = sourceDay?.customLabels || {}
          const sourceCustomColors = sourceDay?.customColors || {}
          
          // Separate merged and non-merged brushes to insert them in the correct positions
          const mergedBrushes: Array<{ brush: string; originalIndex: number; glueId: string }> = []
          const nonMergedBrushes: Array<{ brush: string; originalIndex: number; glueId?: string }> = []
          
          sourceBrushIndices.forEach((originalIndex, i) => {
            const glueId = sourceBrushGlueIds[originalIndex]
            const isMerged = glueId && mergeGlueGroups.has(glueId)
            
            if (isMerged) {
              mergedBrushes.push({
                brush: sourceBrushes[i],
                originalIndex,
                glueId: glueId!
              })
            } else {
              nonMergedBrushes.push({
                brush: sourceBrushes[i],
                originalIndex,
                glueId: glueId
              })
            }
          })
          
          // Build target brushes array: merged brushes at top, then existing brushes, then non-merged moved brushes
          const targetBrushes: string[] = []
          const newTargetBrushGlueIds: Record<number, string> = {}
          const newTargetCustomLabels: Record<number, string> = {}
          const newTargetCustomColors: Record<number, string> = {}
          
          // First, add merged brushes at index 0
          mergedBrushes.forEach((item, i) => {
            targetBrushes.push(item.brush)
            newTargetBrushGlueIds[i] = item.glueId
            // Preserve custom label if it existed
            if (sourceCustomLabels && item.originalIndex in sourceCustomLabels) {
              const customLabel = sourceCustomLabels[item.originalIndex]
              if (customLabel && customLabel.trim() !== '') {
                newTargetCustomLabels[i] = customLabel
              }
            }
            // Preserve custom color if it existed
            if (sourceCustomColors && item.originalIndex in sourceCustomColors) {
              const customColor = sourceCustomColors[item.originalIndex]
              if (customColor && customColor.trim() !== '') {
                newTargetCustomColors[i] = customColor
              }
            }
          })
          
          // Then, add existing brushes (shift their glue IDs, labels, and colors)
          const mergedCount = mergedBrushes.length
          targetDay.brushes.forEach((brush, idx) => {
            const newIdx = mergedCount + idx
            targetBrushes.push(brush)
            // Shift existing glue IDs
            if (targetBrushGlueIds[idx]) {
              newTargetBrushGlueIds[newIdx] = targetBrushGlueIds[idx]
            }
            // Shift existing custom labels
            if (targetCustomLabels[idx]) {
              newTargetCustomLabels[newIdx] = targetCustomLabels[idx]
            }
            // Shift existing custom colors
            if (targetCustomColors[idx]) {
              newTargetCustomColors[newIdx] = targetCustomColors[idx]
            }
          })
          
          // Finally, add non-merged moved brushes
          const existingCount = targetDay.brushes.length
          nonMergedBrushes.forEach((item, i) => {
            const newIdx = mergedCount + existingCount + i
            targetBrushes.push(item.brush)
            // Preserve glue ID if it existed
            if (item.glueId) {
              newTargetBrushGlueIds[newIdx] = item.glueId
            }
            // Preserve custom label if it existed
            if (sourceCustomLabels && item.originalIndex in sourceCustomLabels) {
              const customLabel = sourceCustomLabels[item.originalIndex]
              if (customLabel && customLabel.trim() !== '') {
                newTargetCustomLabels[newIdx] = customLabel
              }
            }
            // Preserve custom color if it existed
            if (sourceCustomColors && item.originalIndex in sourceCustomColors) {
              const customColor = sourceCustomColors[item.originalIndex]
              if (customColor && customColor.trim() !== '') {
                newTargetCustomColors[newIdx] = customColor
              }
            }
          })
          
          // Update targetBrushGlueIds, targetCustomLabels, and targetCustomColors with the new structure
          Object.assign(targetBrushGlueIds, newTargetBrushGlueIds)
          Object.assign(targetCustomLabels, newTargetCustomLabels)
          Object.assign(targetCustomColors, newTargetCustomColors)
          
          // Always set brushGlueIds - use the updated targetBrushGlueIds which includes preserved glue IDs
          // Even if targetBrushGlueIds is empty, we should preserve targetDay's existing brushGlueIds
          const finalBrushGlueIds = Object.keys(targetBrushGlueIds).length > 0 
            ? targetBrushGlueIds 
            : (targetDay.brushGlueIds && Object.keys(targetDay.brushGlueIds).length > 0 ? targetDay.brushGlueIds : undefined)
          
          updatedSchedule[targetDateStr] = {
            ...targetDay,
            brushes: targetBrushes,
            brushGlueIds: finalBrushGlueIds,
            customLabels: Object.keys(targetCustomLabels).length > 0 ? targetCustomLabels : undefined,
            customColors: Object.keys(targetCustomColors).length > 0 ? targetCustomColors : undefined,
          }
          
          return updatedSchedule
        })
        
        // Update glue groups to reflect the moved brushes
        // For each unique glue ID that was moved, update the glue group to include the new date
        const movedGlueIds = new Set<string>()
        const sourceBrushGlueIds = dragState.current.sourceBrushGlueIds || {}
        Object.values(sourceBrushGlueIds).forEach(glueId => {
          if (glueId) movedGlueIds.add(glueId)
        })
        
        // Check if any of the moved glue IDs are merged glue groups
        const movedMergedGlueIds = new Set<string>()
        movedGlueIds.forEach(glueId => {
          if (mergeGlueGroups.has(glueId)) {
            movedMergedGlueIds.add(glueId)
          }
        })
        
        // Update each glue group that had brushes moved
        // Use functional update to read the updated schedule state
        setSchedule(currentSchedule => {
          movedGlueIds.forEach(glueId => {
            const isMergedGlue = movedMergedGlueIds.has(glueId)
            
            setGlueGroups(prev => {
              const glueGroup = prev[glueId]
              if (!glueGroup) {
                // If glue group doesn't exist, create it with the new date
                return {
                  ...prev,
                  [glueId]: {
                    id: glueId,
                    dates: [targetDateStr],
                  },
                }
              }
              
              // For merged glue groups, we need to update ALL dates in the group
              // Find all dates in the schedule that have this merged glue ID
              if (isMergedGlue) {
                const newMergedDates: string[] = []
                Object.keys(currentSchedule).forEach(dateStr => {
                  const day = currentSchedule[dateStr]
                  if (day?.brushGlueIds) {
                    Object.values(day.brushGlueIds).forEach(gId => {
                      if (gId === glueId && !newMergedDates.includes(dateStr)) {
                        newMergedDates.push(dateStr)
                      }
                    })
                  }
                })
                
                // Update the merged glue group with all new dates
                return {
                  ...prev,
                  [glueId]: {
                    ...glueGroup,
                    dates: newMergedDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
                  },
                }
              } else {
                // For regular glue groups, add target date if not already in the group
                let updatedDates = [...glueGroup.dates]
                if (!updatedDates.includes(targetDateStr)) {
                  updatedDates.push(targetDateStr)
                }
                
                // Note: We don't remove source date here because it might still have other brushes with this glue ID
                // The source date will be cleaned up if needed when all brushes with that glue ID are removed
                
                return {
                  ...prev,
                  [glueId]: {
                    ...glueGroup,
                    dates: updatedDates,
                  },
                }
              }
            })
          })
          
          return currentSchedule // Don't modify schedule here
        })
        
        // Ensure merged glue groups are preserved in the mergeGlueGroups set
        // Also check if moved dates became consecutive and should be re-merged
        movedMergedGlueIds.forEach(glueId => {
          setMergeGlueGroups(prev => {
            const updated = new Set(prev)
            updated.add(glueId)
            return updated
          })
          
          // After moving, check if all dates in the merged group are now consecutive
          // If so, they should render as merged; if not, they'll render as separate blocks
          // The rendering logic above will handle this automatically
        })
        
        // For regular glue groups that were moved, check if they should become merged
        // (if they're consecutive and all have the same brush)
        setTimeout(() => {
          setSchedule(currentSchedule => {
            movedGlueIds.forEach(glueId => {
              if (!movedMergedGlueIds.has(glueId)) {
                // This is a regular glue group - check if dates are consecutive
                const glueGroup = glueGroups[glueId]
                if (glueGroup && glueGroup.dates.length > 1) {
                  // Check if all dates have the same brush at the same index
                  const firstDate = glueGroup.dates[0]
                  const firstDay = currentSchedule[firstDate]
                  if (firstDay && firstDay.brushes.length > 0) {
                    const brushId = firstDay.brushes[0]
                    const brushIndex = 0
                    const allHaveSameBrush = glueGroup.dates.every(d => {
                      const dDay = currentSchedule[d]
                      return dDay && dDay.brushes.length > brushIndex && dDay.brushes[brushIndex] === brushId
                    })
                    
                    // If all have same brush and are consecutive, mark as merged
                    if (allHaveSameBrush && areConsecutiveDatesWithWeekendCheck(glueGroup.dates, sabbathMode)) {
                      setMergeGlueGroups(prev => {
                        const updated = new Set(prev)
                        updated.add(glueId)
                        return updated
                      })
                    }
                  }
                }
              }
            })
            return currentSchedule
          })
        }, 0)
        
        setHasUnsavedChanges(true)
      }
      }
    }
    
    dragState.current = {
      isDragging: false,
      startDate: null,
      isGlueDrag: false,
      glueGroupId: null,
      mouseMoved: false,
      lastGlueDragDate: null,
      sourceBrushes: null,
      sourceBrushIndex: null,
      sourceBrushIndices: null,
      sourceBrushGlueIds: null,
      connectedDates: null,
      sourceDateStr: null,
      dragStartTime: null,
      mouseX: null,
      mouseY: null,
      isHolding: false,
    }
    setIsDraggingState(false) // Trigger re-render
    // If we dragged, prevent the click event
    if (wasDragging) {
      preventClickAfterDrag.current = true
      setTimeout(() => {
        preventClickAfterDrag.current = false
      }, 100)
    }
  }, [isGlueMode, sabbathMode, ensureWeekday])

  // Handle click - simple click to paint or glue
  const handleClick = useCallback((date: Date, e: React.MouseEvent) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    // If we just finished a drag, prevent click
    if (preventClickAfterDrag.current) {
      return
    }
    
    // If mouse moved, it was a drag - don't process as click
    if (dragState.current.mouseMoved || dragState.current.isDragging) {
      // This was a drag, not a click
      return
    }
    
    // In glue mode, if we were about to drag (had source brushes), don't process as click
    if (isGlueMode && dragState.current.sourceBrushes && dragState.current.sourceBrushes.length > 0) {
      return
    }
    
    // Reset drag state for next interaction
    dragState.current = {
      isDragging: false,
      startDate: null,
      isGlueDrag: false,
      glueGroupId: null,
      mouseMoved: false,
      lastGlueDragDate: null,
      sourceBrushes: null,
      sourceBrushIndex: null,
      sourceBrushIndices: null,
      sourceBrushGlueIds: null,
      connectedDates: null,
      sourceDateStr: null,
      dragStartTime: null,
      mouseX: null,
      mouseY: null,
      isHolding: false,
    }
    
    const day = getScheduleDay(dateStr)
    const target = e.target as HTMLElement
    const stripeElement = target.closest('[data-brush-index]')
    let brushIndex: number | null = null
    if (stripeElement) {
      brushIndex = parseInt(stripeElement.getAttribute('data-brush-index') || '-1')
      if (brushIndex < 0 || brushIndex >= day.brushes.length) brushIndex = null
    }
    if (brushIndex === null && day.brushes.length > 0) brushIndex = 0
    
    // Paint mode - click block to apply selected color
    if (isPaintMode) {
      if (stripeElement && brushIndex !== null && day.brushes[brushIndex]) {
        saveToHistory()
        setSchedule(prev => {
          const d = prev[dateStr]
          if (!d) return prev
          const customColors = { ...(d.customColors || {}), [brushIndex!]: paintColor }
          return { ...prev, [dateStr]: { ...d, customColors } }
        })
        setHasUnsavedChanges(true)
      }
      return
    }
    
    // Soap (eraser) mode - tap block to delete it
    if (isEraserMode) {
      if (day.brushes.length === 0) return
      if (brushIndex === null) return
      saveToHistory()
      const brushIdToRemove = day.brushes[brushIndex]
      const glueIdToRemove = day.brushGlueIds?.[brushIndex]
      setSchedule(prev => {
        const d = prev[dateStr]
        if (!d) return prev
        const newBrushes = d.brushes.filter((_, i) => i !== brushIndex)
        const newBrushGlueIds: Record<number, string> = {}
        const newCustomLabels: Record<number, string> = {}
        const newCustomColors: Record<number, string> = {}
        d.brushes.forEach((_, idx) => {
          if (idx < brushIndex!) {
            if (d.brushGlueIds?.[idx] !== undefined) newBrushGlueIds[idx] = d.brushGlueIds![idx]
            if (d.customLabels?.[idx] !== undefined) newCustomLabels[idx] = d.customLabels![idx]
            if (d.customColors?.[idx] !== undefined) newCustomColors[idx] = d.customColors![idx]
          } else if (idx > brushIndex!) {
            if (d.brushGlueIds?.[idx] !== undefined) newBrushGlueIds[idx - 1] = d.brushGlueIds![idx]
            if (d.customLabels?.[idx] !== undefined) newCustomLabels[idx - 1] = d.customLabels![idx]
            if (d.customColors?.[idx] !== undefined) newCustomColors[idx - 1] = d.customColors![idx]
          }
        })
        const next = { ...prev, [dateStr]: { ...d, brushes: newBrushes, brushGlueIds: Object.keys(newBrushGlueIds).length > 0 ? newBrushGlueIds : undefined, customLabels: Object.keys(newCustomLabels).length > 0 ? newCustomLabels : undefined, customColors: Object.keys(newCustomColors).length > 0 ? newCustomColors : undefined } }
        return next
      })
      if (glueIdToRemove) {
        const glueGroup = glueGroups[glueIdToRemove]
        const datesLeft = glueGroup ? glueGroup.dates.filter(d => d !== dateStr) : []
        setGlueGroups(prev => {
          const g = prev[glueIdToRemove]
          if (!g) return prev
          const newDates = g.dates.filter(d => d !== dateStr)
          if (newDates.length <= 1) {
            const out = { ...prev }
            delete out[glueIdToRemove]
            return out
          }
          return { ...prev, [glueIdToRemove]: { ...g, dates: newDates } }
        })
        if (mergeGlueGroups.has(glueIdToRemove) && datesLeft.length === 0) {
          setMergeGlueGroups(prev => {
            const next = new Set(prev)
            next.delete(glueIdToRemove)
            return next
          })
        }
      }
      setHasUnsavedChanges(true)
      return
    }
    
    // Hand (copy-paste) mode - first click captures, second click pastes
    if (isCopyPasteMode) {
      if (copyPasteCaptured) {
        // Paste: append brush + label to this date
        saveToHistory()
        setSchedule(prev => {
          const d = prev[dateStr] || { date: dateStr, brushes: [] }
          const insertIdx = d.brushes.length
          const newBrushes = [...d.brushes, copyPasteCaptured.brushId]
          const newLabels: Record<number, string> = {}
          Object.entries(d.customLabels || {}).forEach(([k, v]) => { newLabels[parseInt(k)] = v })
          newLabels[insertIdx] = copyPasteCaptured.label
          return { ...prev, [dateStr]: { ...d, brushes: newBrushes, customLabels: newLabels } }
        })
        setHasUnsavedChanges(true)
        setCopyPasteCaptured(null)
      } else {
        // Capture: remember brush + label from clicked stripe
        if (day.brushes.length > 0 && brushIndex !== null) {
          const brush = brushes.find(b => b.id === day.brushes[brushIndex!])
          const label = (day.customLabels || {})[brushIndex!] || brush?.name || ''
          setCopyPasteCaptured({ brushId: day.brushes[brushIndex!], label, dateStr, brushIndex: brushIndex! })
        }
      }
      return
    }
    
    // Handle merge mode - click to select dates for merging (can click on specific stripes)
    if (isMergeMode) {
      handleMergeClick(date, e)
      return
    }
    
    // Handle unmerge mode - click on a merged block to unmerge it
    if (isUnmergeMode) {
      handleUnmergeClick(date)
      return
    }
    
    // Handle edit mode - click on a stripe to edit its label inline
    if (isEditMode) {
      const day = getScheduleDay(dateStr)
      if (day.brushes.length > 0) {
        // Check if click was on a specific stripe
        const target = e.target as HTMLElement
        const stripeElement = target.closest('[data-brush-index]')
        let brushIndex: number | null = null
        
        if (stripeElement) {
          brushIndex = parseInt(stripeElement.getAttribute('data-brush-index') || '-1')
          if (brushIndex < 0 || brushIndex >= day.brushes.length) {
            brushIndex = null
          }
        }
        
        // If no specific stripe clicked, use first brush
        if (brushIndex === null && day.brushes.length > 0) {
          brushIndex = 0
        }
        
        if (brushIndex !== null) {
          const brush = brushes.find(b => b.id === day.brushes[brushIndex])
          const customLabels = day.customLabels || {}
          const currentLabel = customLabels[brushIndex] || brush?.name || ''
          setEditingDate({ dateStr, brushIndex })
          setEditingLabel(currentLabel)
          return
        }
      }
      return
    }
    
    if (isGlueMode) {
      const day = getScheduleDay(dateStr)
      // Only glue if date has brushes (is colored)
      if (day.brushes.length === 0) {
        // No brushes, can't glue
        return
      }
      
      // Check if click was on a specific stripe
      const target = e.target as HTMLElement
      const stripeElement = target.closest('[data-brush-index]')
      let brushIndex: number | null = null
      
      if (stripeElement) {
        brushIndex = parseInt(stripeElement.getAttribute('data-brush-index') || '-1')
        if (brushIndex < 0 || brushIndex >= day.brushes.length) {
          brushIndex = null
        }
      }
      
      // If no specific stripe clicked, use first brush
      if (brushIndex === null) {
        brushIndex = 0
      }
      
      const brushGlueIds = day.brushGlueIds || {}
      const currentGlueId = brushGlueIds[brushIndex]
      
      // Check if this is a merged glue group
      const isMergedGlue = currentGlueId && mergeGlueGroups.has(currentGlueId)
      const mergedGlueGroup = isMergedGlue && glueGroups[currentGlueId] ? glueGroups[currentGlueId] : null
      
      // Toggle glue for this specific brush
      if (currentGlueId && !isMergedGlue) {
        // Unglue - remove from group (only for non-merged glue)
        saveToHistory() // Save state before modification
        const glueGroup = glueGroups[currentGlueId]
        if (glueGroup) {
          const updatedDates = glueGroup.dates.filter(d => d !== dateStr)
          if (updatedDates.length <= 1) {
            // Remove group if only one date left (or empty)
            const updatedGroups = { ...glueGroups }
            delete updatedGroups[currentGlueId]
            setGlueGroups(updatedGroups)
          } else {
            setGlueGroups(prev => ({
              ...prev,
              [currentGlueId]: {
                ...glueGroup,
                dates: updatedDates,
              },
            }))
          }
        }
        setSchedule(prev => {
          const updatedDay = { ...prev[dateStr] }
          const updatedBrushGlueIds = { ...updatedDay.brushGlueIds }
          delete updatedBrushGlueIds[brushIndex!]
          return {
            ...prev,
            [dateStr]: {
              ...updatedDay,
              brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
            },
          }
        })
        setHasUnsavedChanges(true)
      } else if (isMergedGlue && mergedGlueGroup) {
        // If clicking on a merged box in glue mode, allow dragging (don't unmerge)
        // The drag will be handled by handleStripeMouseDown when clicking on the stripe itself
        // This click handler is for clicking on the date cell, not the stripe
        // So we just return - the stripe click will handle the drag
        return
      } else {
        // Glue - use active glue group if it exists, otherwise create new one
        saveToHistory() // Save state before modification
        let groupIdToUse = activeGlueGroupId
        
        // If no active group or the active group doesn't exist anymore, create a new one
        if (!groupIdToUse || !glueGroups[groupIdToUse]) {
          const newGroupId = `glue-${Date.now()}`
          groupIdToUse = newGroupId
          setActiveGlueGroupId(newGroupId)
          
          // Create the new group
          setGlueGroups(prev => ({
            ...prev,
            [newGroupId]: {
              id: newGroupId,
              dates: [dateStr],
            },
          }))
        } else {
          // Add to existing active group
          const glueGroup = glueGroups[groupIdToUse]
          setGlueGroups(prev => ({
            ...prev,
            [groupIdToUse!]: {
              ...glueGroup,
              dates: [...glueGroup.dates, dateStr],
            },
          }))
        }
        
        // Update the schedule - glue only this specific brush
        setSchedule(prev => {
          const updatedDay = prev[dateStr] || { date: dateStr, brushes: [] }
          const updatedBrushGlueIds = { ...updatedDay.brushGlueIds, [brushIndex!]: groupIdToUse! }
          return {
            ...prev,
            [dateStr]: {
              ...updatedDay,
              brushGlueIds: updatedBrushGlueIds,
            },
          }
        })
        setHasUnsavedChanges(true)
      }
    } else if (selectedBrush) {
      // Simple click to paint - add brush immediately
      addBrushToDate(dateStr, selectedBrush)
    }
  }, [isGlueMode, isEditMode, isUnmergeMode, isCopyPasteMode, copyPasteCaptured, isEraserMode, isPaintMode, paintColor, selectedBrush, getScheduleDay, glueGroups, mergeGlueGroups, activeGlueGroupId, addBrushToDate, saveToHistory, handleUnmergeClick, handleMergeClick, brushes])

  // Handle saving custom label
  const handleSaveLabel = useCallback((dateStr: string, brushIndex: number, label: string) => {
    saveToHistory()
    setSchedule(prev => {
      const day = prev[dateStr] || { date: dateStr, brushes: [] }
      const customLabels = { ...day.customLabels || {} }
      
      // If label is empty or same as brush name, remove custom label
      const brush = brushes.find(b => b.id === day.brushes[brushIndex])
      if (label.trim() && label.trim() !== brush?.name) {
        customLabels[brushIndex] = label.trim()
      } else {
        delete customLabels[brushIndex]
      }
      
      return {
        ...prev,
        [dateStr]: {
          ...day,
          customLabels: Object.keys(customLabels).length > 0 ? customLabels : undefined,
        },
      }
    })
    setEditingDate(null)
    setEditingLabel('')
    setHasUnsavedChanges(true)
  }, [saveToHistory, brushes])

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      // Reset cursor
      document.body.style.cursor = ''
      
      // Reset drag state if we were holding or dragging but conditions aren't met
      if (dragState.current.isHolding || dragState.current.isDragging) {
        // Check if we have multiple connected dates - if so, be more lenient with drag detection
        const hasMultipleConnectedDates = dragState.current.connectedDates && dragState.current.connectedDates.length > 1
        // Only handle if we're actually dragging in glue mode with valid conditions
        // For multiple connected dates, allow even if mouseMoved is false (might be a click-to-move scenario)
        const shouldHandle = isGlueMode && 
                            dragState.current.isDragging && 
                            dragState.current.sourceBrushes && 
                            (dragState.current.mouseMoved || hasMultipleConnectedDates)
        
        if (!shouldHandle) {
          // Clear any pending timeout
          if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current)
            dragTimeoutRef.current = null
          }
          // Reset drag state
          dragState.current = {
            isDragging: false,
            startDate: null,
            isGlueDrag: false,
            glueGroupId: null,
            mouseMoved: false,
            lastGlueDragDate: null,
            sourceBrushes: null,
            sourceBrushIndex: null,
            sourceBrushIndices: null,
            sourceBrushGlueIds: null,
            connectedDates: null,
            sourceDateStr: null,
            dragStartTime: null,
            mouseX: null,
            mouseY: null,
            isHolding: false,
          }
          setIsDraggingState(false)
          setDragPreviewPos(null)
          return
        }
      } else {
        return
      }
      
      // Try to find the date element under the mouse using multiple methods
      const target = e.target as HTMLElement
      
      // Method 1: Try closest ancestor with data-date
      let dateElement = target.closest('[data-date]') as HTMLElement
      
      // Method 2: If not found, try going up the DOM tree
      if (!dateElement) {
        let current: HTMLElement | null = target
        while (current && current !== document.body) {
          if (current.hasAttribute('data-date')) {
            dateElement = current
            break
          }
          current = current.parentElement
        }
      }
      
      // Method 3: Try elementFromPoint as fallback
      if (!dateElement && e.clientX !== undefined && e.clientY !== undefined) {
        const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY)
        if (elementAtPoint) {
          const foundElement = elementAtPoint.closest('[data-date]') as HTMLElement
          if (foundElement) {
            dateElement = foundElement
          }
        }
      }
      
      let date: Date | undefined
      
      if (dateElement) {
        const dateStr = dateElement.getAttribute('data-date')
        if (dateStr) {
          try {
            date = new Date(dateStr)
            // Validate the date is valid
            if (isNaN(date.getTime())) {
              date = undefined
            }
          } catch {
            date = undefined
          }
        }
      }
      
      // Always call handleMouseUp - it will handle the case where date is undefined
      handleMouseUp(date)
    }
    
    const handleGlobalMouseLeave = () => {
      // If dragging or holding, cancel drag when mouse leaves window
      if (dragState.current.isDragging || dragState.current.isHolding) {
        // Clear any pending timeout
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current)
          dragTimeoutRef.current = null
        }
        // Reset drag state completely
        document.body.style.cursor = ''
        dragState.current = {
          isDragging: false,
          startDate: null,
          isGlueDrag: false,
          glueGroupId: null,
          mouseMoved: false,
          lastGlueDragDate: null,
          sourceBrushes: null,
          sourceBrushIndex: null,
          sourceBrushIndices: null,
          sourceBrushGlueIds: null,
          connectedDates: null,
          sourceDateStr: null,
          dragStartTime: null,
          mouseX: null,
          mouseY: null,
          isHolding: false,
        }
        setIsDraggingState(false)
        setDragPreviewPos(null)
      }
    }
    
    // Also handle context menu (right click) to cancel drag
    const handleContextMenu = () => {
      if (dragState.current.isDragging || dragState.current.isHolding) {
        // Clear any pending timeout
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current)
          dragTimeoutRef.current = null
        }
        // Reset drag state
        dragState.current = {
          isDragging: false,
          startDate: null,
          isGlueDrag: false,
          glueGroupId: null,
          mouseMoved: false,
          lastGlueDragDate: null,
          sourceBrushes: null,
          sourceBrushIndex: null,
          sourceBrushIndices: null,
          sourceBrushGlueIds: null,
          connectedDates: null,
          sourceDateStr: null,
          dragStartTime: null,
          mouseX: null,
          mouseY: null,
          isHolding: false,
        }
        setIsDraggingState(false)
        setDragPreviewPos(null)
        document.body.style.cursor = ''
      }
    }
    
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mouseleave', handleGlobalMouseLeave)
    window.addEventListener('contextmenu', handleContextMenu)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mouseleave', handleGlobalMouseLeave)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [isGlueMode, handleMouseUp])

  // Don't close tool menu when clicking outside - user wants to keep it open while working

  // Load timeline when selected
  const loadTimeline = useCallback(async (timelineId: string) => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/production-schedule?id=${timelineId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const text = await response.text()
        if (!text || text.trim() === '') {
          console.error('Empty response from server')
          return
        }
        try {
          const data = JSON.parse(text)
          setCurrentTimelineId(data.id)
          setCurrentTimelineTitle(data.title)
          if (data.brushes && data.brushes.length > 0) {
            setBrushes(data.brushes)
          }
          if (data.schedule) {
            setSchedule(data.schedule)
          }
          if (data.glueGroups) {
            setGlueGroups(data.glueGroups)
          }
          if (data.mergeGlueGroups && Array.isArray(data.mergeGlueGroups)) {
            setMergeGlueGroups(new Set(data.mergeGlueGroups))
          }
          setShowTimelineList(false)
          setHasUnsavedChanges(false)
          // Focus on calendar when timeline loads
          setTimeout(() => {
            const calendarElement = document.querySelector('[data-calendar-container]')
            if (calendarElement) {
              calendarElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }, 100)
          // Focus on calendar when timeline loads
          setTimeout(() => {
            const calendarElement = document.querySelector('[data-calendar-container]')
            if (calendarElement) {
              calendarElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }, 100)
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError, 'Response text:', text)
        }
      }
    } catch (error) {
      console.error('Error loading timeline:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle creating new timeline
  const handleCreateNew = async (timelineName: string, startMonth: Date) => {
    try {
      setIsLoading(true)
      setShowNewTimelineModal(false)
      console.log('Creating timeline:', timelineName, 'Starting month:', startMonth)
      const response = await fetch('/api/production-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: timelineName,
          brushes: brushes,
          schedule: {},
          glueGroups: {},
        }),
      })
      
      const text = await response.text()
      if (!text || text.trim() === '') {
        console.error('Empty response from server')
        alert('Failed to create timeline: Empty response from server')
        setShowNewTimelineModal(true)
        return
      }
      
      let responseData
      try {
        responseData = JSON.parse(text)
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError, 'Response text:', text)
        alert('Failed to create timeline: Invalid response from server')
        setShowNewTimelineModal(true)
        return
      }
      
      console.log('Response status:', response.status)
      console.log('Response data:', responseData)
      
      if (response.ok) {
        setCurrentTimelineId(responseData.timeline.id)
        setCurrentTimelineTitle(responseData.timeline.title)
        // Set the visible months to start with the selected month
        setVisibleMonths([startOfMonth(startMonth)])
        setCurrentMonth(startOfMonth(startMonth))
        setShowTimelineList(false)
        setHasUnsavedChanges(false)
      } else {
        const errorMessage = responseData.error || responseData.details || 'Unknown error'
        console.error('Failed to create timeline:', errorMessage)
        alert(`Failed to create timeline: ${errorMessage}\n\nCheck the browser console for more details.`)
        setShowNewTimelineModal(true)
      }
    } catch (error) {
      console.error('Error creating timeline:', error)
      alert('Failed to create timeline: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n\nCheck the browser console for more details.')
      setShowNewTimelineModal(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle selecting existing timeline
  const handleSelectTimeline = async (timelineId: string) => {
    await loadTimeline(timelineId)
  }

  // Handle back to timeline list
  const handleBackToTimelines = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to go back?')) {
        return
      }
    }
    setShowTimelineList(true)
    setCurrentTimelineId(null)
    setCurrentTimelineTitle('')
    setSchedule({})
    setGlueGroups({})
    setHasUnsavedChanges(false)
  }

  // Apply a parsed AI schedule to the timeline (called after user confirms preview or directly for text-only)
  const applyAIScheduleToTimeline = useCallback((scheduleData: unknown[]) => {
    if (!Array.isArray(scheduleData)) return
    saveToHistory()
    // Normalize: infer mergeWithPrevious when same activity appears on consecutive days (AI sometimes omits it)
    const sorted = ([...scheduleData] as Array<{ date?: string; stripes?: unknown[] }>)
      .filter((item) => item && typeof item === 'object' && item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    
    // Track which activities appeared on the previous day (for merge detection)
    const prevDayActivities = new Set<string>()
    const normalized = sorted.map((item, idx) => {
      const typedItem = item as { date: string; stripes?: Array<{ activity: string; label?: string; mergeWithPrevious?: boolean }> }
      const currentDayActivities = new Set<string>()
      const stripes = Array.isArray(typedItem.stripes) ? typedItem.stripes.map((stripe) => {
        const activity = stripe.activity
        currentDayActivities.add(activity)
        
        // Check if this activity was on the previous day (match by activity name, not index)
        const wasOnPrevDay = prevDayActivities.has(activity)
        
        // If AI said mergeWithPrevious, trust it. Otherwise, infer from consecutive same activity.
        const shouldMerge = stripe.mergeWithPrevious === true || (wasOnPrevDay && stripe.mergeWithPrevious !== false)
        
        return { ...stripe, mergeWithPrevious: shouldMerge }
      }) : []
      
      // Update prevDayActivities for next iteration
      prevDayActivities.clear()
      currentDayActivities.forEach(a => prevDayActivities.add(a))
      
      return { date: typedItem.date, stripes }
    })
    const scheduleDataToUse = normalized

    const sortedForKeys = [...scheduleDataToUse].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
    const colorKeySet = new Set<string>()
    const lastLabelByActivityForKeys: Record<string, string> = {}
    sortedForKeys.forEach((item: { date: string; stripes?: Array<{ activity: string; label?: string; mergeWithPrevious?: boolean }> }) => {
      if (!item.stripes) return
      item.stripes.forEach((stripe: { activity: string; label?: string; mergeWithPrevious?: boolean }) => {
        const key = (stripe.label && stripe.label.trim())
          ? stripe.label.trim()
          : (stripe.mergeWithPrevious ? (lastLabelByActivityForKeys[stripe.activity] ?? stripe.activity) : stripe.activity)
        if (stripe.label && stripe.label.trim()) lastLabelByActivityForKeys[stripe.activity] = stripe.label.trim()
        colorKeySet.add(key)
      })
    })
    const colorKeys = Array.from(colorKeySet)
    const labelToBrushId: Record<string, string> = {}
    colorKeys.forEach((key, i) => {
      const brush = brushes[i % brushes.length]
      if (brush) labelToBrushId[key] = brush.id
    })
    const newSchedule: Record<string, ScheduleDay> = {}
    const sortedSchedule = [...scheduleDataToUse].sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))
    const lastLabelByActivity: Record<string, string> = {}
    sortedSchedule.forEach((item: { date: string; stripes?: Array<{ activity: string; label?: string; mergeWithPrevious?: boolean }> }) => {
      const dateStr = item.date
      const day: ScheduleDay = { date: dateStr, brushes: [], customLabels: {} }
      if (!item.stripes) {
        if (day.brushes.length > 0) newSchedule[dateStr] = day
        return
      }
      item.stripes.forEach((stripe, stripeIndex) => {
        const effectiveLabel = (stripe.label && stripe.label.trim())
          ? stripe.label.trim()
          : (stripe.mergeWithPrevious ? (lastLabelByActivity[stripe.activity] ?? stripe.activity) : stripe.activity)
        if (stripe.label && stripe.label.trim()) lastLabelByActivity[stripe.activity] = stripe.label.trim()
        const colorKey = effectiveLabel
        const brushId = labelToBrushId[colorKey]
        if (!brushId) {
          const fallback = brushes.find(b => b.name === stripe.activity)
          if (fallback) {
            day.brushes.push(fallback.id)
            day.customLabels = day.customLabels || {}
            day.customLabels[stripeIndex] = effectiveLabel
          }
          return
        }
        day.brushes.push(brushId)
        day.customLabels = day.customLabels || {}
        day.customLabels[stripeIndex] = effectiveLabel
      })
      if (day.brushes.length > 0) newSchedule[dateStr] = day
    })
    // Create glue groups for merged blocks - use ACTIVITY name as the key for consistency
    const newGlueGroups: Record<string, GlueGroup> = {}
    const newMergeGlueGroups = new Set<string>()
    type ActivityState = { lastDateStr: string; lastBrushIndex: number; activeGlueId: string | null }
    const perActivity: Record<string, ActivityState> = {} // Use activity name as key
    
    sortedSchedule.forEach((item: { date: string; stripes?: Array<{ activity: string; label?: string; mergeWithPrevious?: boolean }> }) => {
      const dateStr = item.date
      const day = newSchedule[dateStr]
      if (!day) return
      if (!item.stripes) return
      
      item.stripes.forEach((stripe, stripeIndex) => {
        // Use activity name as the key for matching merged blocks
        const activityKey = stripe.activity
        const state = perActivity[activityKey]
        
        if (stripe.mergeWithPrevious && state) {
          const { lastDateStr, lastBrushIndex, activeGlueId } = state
          const prevDay = newSchedule[lastDateStr]
          if (prevDay) {
            if (activeGlueId) {
              // Continue existing glue group
              newGlueGroups[activeGlueId].dates.push(dateStr)
              day.brushGlueIds = { ...day.brushGlueIds, [stripeIndex]: activeGlueId }
              // Update state with current position
              perActivity[activityKey] = { lastDateStr: dateStr, lastBrushIndex: stripeIndex, activeGlueId }
            } else {
              // Start new glue group
              const glueId = `ai-merge-${Date.now()}-${activityKey.replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 9)}`
              newGlueGroups[glueId] = { id: glueId, dates: [lastDateStr, dateStr] }
              if (!prevDay.brushGlueIds) prevDay.brushGlueIds = {}
              prevDay.brushGlueIds[lastBrushIndex] = glueId
              day.brushGlueIds = { ...day.brushGlueIds, [stripeIndex]: glueId }
              newMergeGlueGroups.add(glueId)
              perActivity[activityKey] = { lastDateStr: dateStr, lastBrushIndex: stripeIndex, activeGlueId: glueId }
            }
            return
          }
        }
        
        // Not a merge continuation - reset glue ID but track position
        if (!stripe.mergeWithPrevious) {
          perActivity[activityKey] = { lastDateStr: dateStr, lastBrushIndex: stripeIndex, activeGlueId: null }
        } else {
          // mergeWithPrevious is true but no state - still track for future
          perActivity[activityKey] = { lastDateStr: dateStr, lastBrushIndex: stripeIndex, activeGlueId: state?.activeGlueId || null }
        }
      })
    })
    setSchedule(newSchedule)
    setGlueGroups(newGlueGroups)
    setMergeGlueGroups(newMergeGlueGroups)
    setHasUnsavedChanges(true)
  }, [brushes, saveToHistory])

  // Handle AI schedule generation: with PDF → step "recognize" (text summary); text-only → single call (JSON)
  const handleAIGenerate = useCallback(async () => {
    const hasPdfImages = pdfPageImages.length > 0
    const hasInput = aiInput.trim().length > 0
    if (!hasPdfImages && !hasInput) {
      setAiError('Please enter timeline directions and/or upload a PDF calendar')
      return
    }

    setIsAILoading(true)
    setAiError(null)

    const fullPrompt = hasInput
      ? aiInput.trim()
      : (hasPdfImages
          ? 'Look at the calendar image(s) and describe every day in the requested format.'
          : '')

    try {
      // With PDF: first step is "recognize" → AI returns day-by-day text summary
      const step = hasPdfImages ? 'recognize' : undefined
      const response = await fetch('/api/ai-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: fullPrompt,
          currentMonth: currentMonth.toISOString(),
          brushes: brushes,
          ...(hasPdfImages && { images: pdfPageImages }),
          ...(step && { step }),
        }),
      })

      if (!response.ok) {
        let errorMessage = `Failed to generate schedule (${response.status})`
        try {
          const errorData = await response.json()
          if (errorData?.error) errorMessage = errorData.error
        } catch {
          const text = await response.text()
          if (text?.startsWith('<!')) errorMessage = 'Server returned an error. Check that OPENAI_API_KEY is set in .env and restart the dev server.'
          else if (text) errorMessage = text.slice(0, 200)
        }
        throw new Error(errorMessage)
      }

      const data = await response.json().catch(() => null)
      if (!data) throw new Error('Invalid response from server (not JSON).')

      if (step === 'recognize') {
        const summary = typeof data.summary === 'string' ? data.summary : ''
        const sentToOpenAI = data.sentToOpenAI && typeof data.sentToOpenAI.prompt === 'string'
          ? { prompt: data.sentToOpenAI.prompt, imageCount: Number(data.sentToOpenAI.imageCount) || pdfPageImages.length }
          : { prompt: fullPrompt, imageCount: pdfPageImages.length }
        setPendingAIResult({ kind: 'recognize', summary, sentToOpenAI })
        setAiInput(summary) // Put it in the text box so you can edit and send it
        return
      }

      if (!data.schedule || !Array.isArray(data.schedule)) {
        throw new Error('Invalid response format from AI')
      }
      
      // Text-only (no PDF): apply schedule directly without preview
      applyAIScheduleToTimeline(data.schedule)
      setShowAIModal(false)
      setAiInput('')
      setPdfPageImages([])
      setPdfFileName('')
      setAiError(null)
    } catch (error: any) {
      console.error('Error generating AI schedule:', error)
      setAiError(error.message || 'Failed to generate schedule. Please try again.')
    } finally {
      setIsAILoading(false)
    }
  }, [aiInput, pdfPageImages, currentMonth, brushes, applyAIScheduleToTimeline])

  // After user confirms the recognized text summary, feed it to the AI to get JSON and apply to timeline
  const handleConfirmAndPopulate = useCallback(async () => {
    if (!pendingAIResult || pendingAIResult.kind !== 'recognize' || !pendingAIResult.summary.trim()) return
    setIsAILoading(true)
    setAiError(null)
    try {
      const response = await fetch('/api/ai-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: 'populate', summary: pendingAIResult.summary }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error((err as { error?: string })?.error || `Failed (${response.status})`)
      }
      const data = await response.json()
      if (!data.schedule || !Array.isArray(data.schedule)) throw new Error('Invalid schedule from AI')
      applyAIScheduleToTimeline(data.schedule)
      setPendingAIResult(null)
      setShowAIModal(false)
      setAiInput('')
      setPdfPageImages([])
      setPdfFileName('')
      setAiError(null)
    } catch (e: any) {
      setAiError(e.message || 'Failed to populate schedule.')
    } finally {
      setIsAILoading(false)
    }
  }, [pendingAIResult, aiInput, applyAIScheduleToTimeline])

  // Render PDF to images in browser and send to OpenAI Vision
  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') {
      setAiError(file ? 'Please select a PDF file' : null)
      return
    }
    setAiError(null)
    setIsPdfLoading(true)
    setPdfPageImages([])
    setPdfFileName(file.name)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs'
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const numPages = Math.min(pdf.numPages, 15)
      const scale = 1.5
      const dataUrls: string[] = []
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        canvas.width = viewport.width
        canvas.height = viewport.height
        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        })
        await (renderTask.promise ?? renderTask)
        dataUrls.push(canvas.toDataURL('image/png'))
      }
      setPdfPageImages(dataUrls)
    } catch (error: any) {
      setAiError(error?.message || 'Failed to read PDF')
      setPdfFileName('')
    } finally {
      setIsPdfLoading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }, [])

  const clearPdf = useCallback(() => {
    setPdfPageImages([])
    setPdfFileName('')
    if (pdfInputRef.current) pdfInputRef.current.value = ''
  }, [])

  // Save schedule to database
  const handleSave = async () => {
    if (!currentTimelineId) {
      alert('No timeline selected')
      return
    }

    try {
      setIsSaving(true)
      // Ensure schedule data is properly serialized
      const serializedSchedule = Object.keys(schedule).reduce((acc, dateStr) => {
        const day = schedule[dateStr]
        acc[dateStr] = {
          ...day,
          // Ensure brushGlueIds is properly formatted
          brushGlueIds: day.brushGlueIds && Object.keys(day.brushGlueIds).length > 0 
            ? day.brushGlueIds 
            : undefined,
          // Ensure customLabels is properly formatted
          customLabels: day.customLabels && Object.keys(day.customLabels).length > 0 
            ? day.customLabels 
            : undefined,
          // Ensure customColors is properly formatted
          customColors: day.customColors && Object.keys(day.customColors).length > 0 
            ? day.customColors 
            : undefined,
        }
        return acc
      }, {} as Record<string, any>)
      
      const response = await fetch('/api/production-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: currentTimelineId,
          brushes,
          schedule: serializedSchedule,
          glueGroups,
          mergeGlueGroups: Array.from(mergeGlueGroups),
        }),
      })
      if (response.ok) {
        setHasUnsavedChanges(false)
        alert('Timeline saved successfully!')
      } else {
        const text = await response.text()
        let errorData
        try {
          errorData = text ? JSON.parse(text) : { error: 'Unknown error' }
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError, 'Response text:', text)
          errorData = { error: `Server error (${response.status})` }
        }
        alert(`Failed to save: ${errorData.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving timeline:', error)
      alert('Failed to save timeline')
    } finally {
      setIsSaving(false)
    }
  }

  // Export schedule to Excel (CSV - opens in Excel)
  const handleExportToExcel = useCallback(() => {
    const dateStrs = Object.keys(schedule).sort()
    if (dateStrs.length === 0) {
      alert('No schedule data to export')
      return
    }
    const maxStripes = Math.max(0, ...dateStrs.map(d => (schedule[d]?.brushes?.length || 0)))
    const header = ['Date', ...Array.from({ length: maxStripes }, (_, i) => `Task ${i + 1}`)]
    const rows: string[][] = [header]
    dateStrs.forEach(dateStr => {
      const day = schedule[dateStr]
      const labels: string[] = []
      for (let i = 0; i < maxStripes; i++) {
        const brushId = day?.brushes?.[i]
        const customLabel = day?.customLabels?.[i]
        const brushName = brushId ? brushes.find(b => b.id === brushId)?.name ?? '' : ''
        labels.push(customLabel || brushName || '')
      }
      rows.push([dateStr, ...labels])
    })
    const escape = (v: string) => {
      if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
      return v
    }
    const csv = rows.map(row => row.map(escape).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(currentTimelineTitle || 'production-schedule').replace(/[^a-z0-9-_]/gi, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [schedule, brushes, currentTimelineTitle, format])

  // Create new brush
  const handleCreateBrush = () => {
    if (!newBrushName.trim()) return
    const newBrush: Brush = {
      id: `brush-${Date.now()}`,
      name: newBrushName.trim(),
      color: newBrushColor,
      isDefault: false,
    }
    setBrushes([...brushes, newBrush])
    setNewBrushName('')
    setShowBrushCreator(false)
    setSelectedBrush(newBrush.id)
    setIsCopyPasteMode(false)
    setCopyPasteCaptured(null)
    setIsEraserMode(false)
    setHasUnsavedChanges(true)
  }

  // Delete brush
  const handleDeleteBrush = (brushId: string) => {
    const brush = brushes.find(b => b.id === brushId)
    if (brush?.isDefault) return // Can't delete default brushes
    
    setBrushes(brushes.filter(b => b.id !== brushId))
    if (selectedBrush === brushId) {
      setSelectedBrush(null)
    }
    
    // Remove brush from all dates
    const updatedSchedule = { ...schedule }
    Object.keys(updatedSchedule).forEach(dateStr => {
      updatedSchedule[dateStr] = {
        ...updatedSchedule[dateStr],
        brushes: updatedSchedule[dateStr].brushes.filter(id => id !== brushId),
      }
    })
    setSchedule(updatedSchedule)
    setHasUnsavedChanges(true)
  }

  // Render horizontal stripes for a date
  const renderDateStripes = (day: ScheduleDay, dateStr: string) => {
    if (day.brushes.length === 0) return null
    
    const brushGlueIds = day.brushGlueIds || {}
    
    // Separate merged and non-merged stripes
    const mergedStripes: Array<{ brushId: string; index: number }> = []
    const nonMergedStripes: Array<{ brushId: string; index: number }> = []
    
    day.brushes.forEach((brushId, index) => {
      const glueId = brushGlueIds[index]
      const isMerged = glueId && mergeGlueGroups.has(glueId)
      if (isMerged) {
        mergedStripes.push({ brushId, index })
      } else {
        nonMergedStripes.push({ brushId, index })
      }
    })
    
    // Sort merged stripes by index to ensure correct stacking order
    mergedStripes.sort((a, b) => a.index - b.index)
    
    // Safety check: ensure no merged brushes accidentally end up in nonMergedStripes
    // Also prevent duplicate brushIds from appearing in both arrays
    const mergedBrushIds = new Set(mergedStripes.map(s => s.brushId))
    const filteredNonMergedStripes = nonMergedStripes.filter(({ brushId, index }) => {
      // Exclude if this brushId is already in merged stripes (prevents duplicates)
      if (mergedBrushIds.has(brushId)) {
        return false
      }
      // Also check by glueId to be extra safe
      const glueId = brushGlueIds[index]
      const isMerged = glueId && mergeGlueGroups.has(glueId)
      return !isMerged // Only keep non-merged brushes
    })
    
    // Calculate heights: merged stripes get fixed height, non-merged share remaining space
    const mergedStripeHeight = 23 // Fixed height for merged stripes
    const totalMergedHeight = mergedStripes.length * mergedStripeHeight
    const remainingHeight = 100 - totalMergedHeight
    const nonMergedStripeHeight = filteredNonMergedStripes.length > 0 ? remainingHeight / filteredNonMergedStripes.length : 0
    
    return (
      <div className="absolute inset-0">
        {/* Render merged stripes first (thin lines stacked vertically, each day renders its own) */}
        {mergedStripes.map(({ brushId, index }, mergedIdx) => {
          const brush = brushes.find(b => b.id === brushId)
          if (!brush) return null
          
          const glueId = brushGlueIds[index]
          const glueGroup = glueId ? glueGroups[glueId] : null
          const mergedDates = glueGroup?.dates ? [...glueGroup.dates].sort() : []
          const isFirstDayOfMergedBlock = mergedDates.length > 0 && dateStr === mergedDates[0]
          const weekStart = mergedDates.length > 0 ? startOfWeek(parseISO(dateStr), { weekStartsOn: 0 }) : null
          const weekEnd = weekStart ? addWeeks(weekStart, 1) : null
          const firstDateInThisWeek = mergedDates.length > 0 && weekStart && weekEnd
            ? mergedDates.find(d => {
                const t = parseISO(d).getTime()
                return t >= weekStart.getTime() && t < weekEnd.getTime()
              })
            : undefined
          const isFirstDayOfWeekInBlock = firstDateInThisWeek !== undefined && dateStr === firstDateInThisWeek
          const showLabelHere = isFirstDayOfMergedBlock || isFirstDayOfWeekInBlock
          const customLabels = day.customLabels || {}
          const customLabel = customLabels[index]
          const displayLabel = customLabel || brush.name
          const showMergedLabel = showLabelHere ? displayLabel : ''
          const isEditing = editingDate?.dateStr === dateStr && editingDate?.brushIndex === index
          const isSelectedForMerge = isMergeMode && pendingMergeSelections.some(
            sel => sel.dateStr === dateStr && sel.brushIndex === index
          )
          const isCopied = copyPasteCaptured && copyPasteCaptured.dateStr === dateStr && copyPasteCaptured.brushIndex === index
          
          return (
            <div
              key={`merged-${brushId}-${index}`}
              data-brush-index={index}
              className={`flex items-center justify-center px-1 relative ${isGlueMode && !isEditMode && !isMergeMode ? 'pointer-events-auto cursor-grab' : isEditMode ? 'pointer-events-auto cursor-pointer' : isMergeMode ? 'pointer-events-auto cursor-pointer' : isPaintMode ? 'pointer-events-auto cursor-pointer' : isCopyPasteMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${isSelectedForMerge ? 'ring-2 ring-green-400 ring-offset-1' : ''} ${isCopied ? 'ring-2 ring-purple-500 ring-offset-1 shadow-lg' : ''}`}
              style={{
                height: `${mergedStripeHeight}%`,
                width: '100%',
                backgroundColor: (day.customColors && day.customColors[index]) || brush.color,
                color: '#fff',
                position: 'absolute',
                top: `${mergedIdx * mergedStripeHeight}%`,
                left: '0',
                zIndex: 5,
              }}
              onMouseDown={(e) => {
                if (isGlueMode && !isEditMode && !isMergeMode) {
                  e.stopPropagation()
                  handleStripeMouseDown(dateStr, index, e)
                }
              }}
            >
              {isEditing ? (
                <div className="flex flex-col items-center gap-0.5 w-full">
                  <input
                    type="text"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSaveLabel(dateStr, index, editingLabel)
                        setEditingDate(null)
                        setEditingLabel('')
                      } else if (e.key === 'Escape') {
                        setEditingDate(null)
                        setEditingLabel('')
                      }
                    }}
                    className="text-[10px] font-medium bg-white/90 text-black px-1 rounded border-none outline-none w-full max-w-[80px] text-center"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      handleSaveLabel(dateStr, index, editingLabel)
                      setEditingDate(null)
                      setEditingLabel('')
                    }}
                    className="text-xs bg-green-500 hover:bg-green-600 text-white rounded px-1.5 py-0.5 transition-colors shadow-sm flex-shrink-0"
                    title="Confirm change"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-[8px] font-medium truncate text-center w-full">{showMergedLabel}</span>
                  {/* Link icon for merged (glued) stripe */}
                  <span className="absolute top-0.5 right-0.5 text-[10px] opacity-90" title="Glued">🔗</span>
                </>
              )}
            </div>
          )
        })}
        
        {/* Render non-merged stripes below (filling remaining space with no gap) */}
        {filteredNonMergedStripes.length > 0 && (
          <div className="absolute" style={{ top: `${totalMergedHeight}%`, bottom: '0', left: '0', right: '0' }}>
            {filteredNonMergedStripes.map(({ brushId, index }, stripeIdx) => {
              const brush = brushes.find(b => b.id === brushId)
              if (!brush) return null
              
              const glueId = brushGlueIds[index]
              const isGlued = glueId !== undefined && !mergeGlueGroups.has(glueId) // Only non-merged glue
              
              const customLabels = day.customLabels || {}
              const customLabel = customLabels[index]
              const displayLabel = customLabel || brush.name
              const isEditing = editingDate?.dateStr === dateStr && editingDate?.brushIndex === index
              
              // Check if this stripe is being dragged
              const isBeingDragged = isGlueMode && (dragState.current.isHolding || isDraggingState) && (
                (dragState.current.startDate === dateStr && 
                 dragState.current.sourceBrushIndices && 
                 dragState.current.sourceBrushIndices.includes(index)) ||
                (dragState.current.connectedDates && 
                 dragState.current.connectedDates.some(cd => 
                   cd.dateStr === dateStr && 
                   cd.brushIndex === index
                 ))
              )
              
              // Check if this stripe is selected for merging
              const isSelectedForMerge = isMergeMode && pendingMergeSelections.some(
                sel => sel.dateStr === dateStr && sel.brushIndex === index
              )
              
              // Check if this stripe is the copied one (for hand mode highlight)
              const isCopied = copyPasteCaptured && copyPasteCaptured.dateStr === dateStr && copyPasteCaptured.brushIndex === index
              
              // Calculate position: each stripe fills equal portion of the container (which is the remaining space)
              // Position is relative to the container (0-100%), not the full date cell
              const stripeTop = (stripeIdx / filteredNonMergedStripes.length) * 100
              const stripeHeight = 100 / filteredNonMergedStripes.length
              
              return (
                <div
                  key={`${brushId}-${index}`}
                  data-brush-index={index}
                  className={`flex items-center justify-center px-1 relative ${isGlueMode && !isEditMode && !isMergeMode ? 'pointer-events-auto cursor-grab' : isEditMode ? 'pointer-events-auto cursor-pointer' : isMergeMode ? 'pointer-events-auto cursor-pointer' : isPaintMode ? 'pointer-events-auto cursor-pointer' : isCopyPasteMode ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${isBeingDragged ? 'opacity-50' : ''} ${isSelectedForMerge ? 'ring-2 ring-green-400 ring-offset-1' : ''} ${isCopied ? 'ring-2 ring-purple-500 ring-offset-1 shadow-lg' : ''}`}
                  style={{
                    height: `${stripeHeight}%`,
                    width: '100%',
                    backgroundColor: (day.customColors && day.customColors[index]) || brush.color,
                    color: '#fff',
                    position: 'absolute',
                    top: `${stripeTop}%`,
                    left: '0',
                  }}
                onMouseDown={(e) => {
                  if (isGlueMode && !isEditMode && !isMergeMode) {
                    e.stopPropagation()
                    handleStripeMouseDown(dateStr, index, e)
                  }
                }}
              >
                {isEditing ? (
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSaveLabel(dateStr, index, editingLabel)
                          setEditingDate(null)
                          setEditingLabel('')
                        } else if (e.key === 'Escape') {
                          setEditingDate(null)
                          setEditingLabel('')
                        }
                      }}
                      className="text-[10px] font-medium bg-white/90 text-black px-1 rounded border-none outline-none w-full max-w-[80px] text-center"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        handleSaveLabel(dateStr, index, editingLabel)
                        setEditingDate(null)
                        setEditingLabel('')
                      }}
                      className="text-xs bg-green-500 hover:bg-green-600 text-white rounded px-1.5 py-0.5 transition-colors shadow-sm flex-shrink-0"
                      title="Confirm change"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] font-medium truncate text-center w-full">{displayLabel}</span>
                    {/* Link icon when this stripe has glue (non-merged) */}
                    {isGlued && (
                      <span className="absolute top-0.5 right-0.5 text-[10px] opacity-90" title="Glued">🔗</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
          </div>
        )}
      </div>
    )
  }

  if (showTimelineList) {
    return (
      <div className="w-full">
        <div className="mb-4">
          <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
            <span>🤖</span> AI Production Schedule Maker
          </h2>
          <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-0.5 md:mt-1">
            Create and manage your production timelines
          </p>
        </div>
        <TimelineList
          onSelectTimeline={handleSelectTimeline}
          onCreateNew={() => setShowNewTimelineModal(true)}
        />
        {showNewTimelineModal && (
          <NewTimelineModal
            onClose={() => setShowNewTimelineModal(false)}
            onCreate={handleCreateNew}
          />
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Horizontal Tool Bar - Always visible at top */}
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-100 to-blue-50 backdrop-blur-lg border-b border-slate-300 shadow-lg" 
        data-tool-menu
        onClick={(e) => {
          // Close brush dropdown if clicking outside of it
          const target = e.target as HTMLElement
          if (!target.closest('[data-brush-dropdown]')) {
            setShowBrushDropdown(false)
          }
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {/* AI Assistant */}
          <button
            onClick={() => {
              setShowAIModal(true)
              setAiError(null)
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium transition-all text-xs shadow-md"
          >
            🤖 AI Assistant
          </button>

          <div className="h-6 w-px bg-slate-300"></div>

          {/* Brushes Dropdown */}
          <div className="relative" data-brush-dropdown>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowBrushDropdown(!showBrushDropdown)
              }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all text-xs font-medium bg-white flex items-center gap-1.5 ${
                selectedBrush && !isGlueMode
                  ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                  : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
              }`}
            >
              🎨 Brushes
              {selectedBrush && !isGlueMode && (
                <span className="text-[10px]">({brushes.find(b => b.id === selectedBrush)?.name})</span>
              )}
            </button>
            
            {showBrushDropdown && (
              <div 
                className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-300 rounded-lg shadow-lg z-50 max-h-[400px] overflow-y-auto min-w-[200px]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-slate-200">
                  <button
                    onClick={() => {
                      setShowBrushCreator(true)
                      setShowBrushDropdown(false)
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium transition-all text-xs"
                  >
                    + Create New Brush
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {brushes.map(brush => (
                    <button
                      key={brush.id}
                      onClick={() => {
                        setSelectedBrush(brush.id)
                        setIsGlueMode(false)
                        setIsCopyPasteMode(false)
                        setCopyPasteCaptured(null)
                        setIsEraserMode(false)
                        setIsPaintMode(false)
                        setShowBrushDropdown(false)
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg border-2 transition-all text-xs font-medium ${
                        selectedBrush === brush.id && !isGlueMode
                          ? 'border-purple-500 bg-purple-50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                      style={{
                        color: brush.color,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{brush.name}</span>
                        {!brush.isDefault && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBrush(brush.id)
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-300"></div>

          {/* Modes */}
          <button
            onClick={() => {
              const newGlueMode = !isGlueMode
              setIsGlueMode(newGlueMode)
              setSelectedBrush(null)
              if (newGlueMode) {
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsMergeMode(false)
                setIsUnmergeMode(false)
                setIsPaintMode(false)
                setPendingMergeDates([])
                setPendingMergeSelections([])
                setPendingMergeBrushId(null)
                setPendingMergeBrushIndex(null)
                setIsEditMode(false)
                setEditingDate(null)
                setEditingLabel('')
                setActiveGlueGroupId(null)
                  } else {
                    setIsEraserMode(false)
                    setIsCopyPasteMode(false)
                    setCopyPasteCaptured(null)
                    setActiveGlueGroupId(null)
                    saveToHistory()
                    setSchedule(prev => {
                      const updatedSchedule: Record<string, ScheduleDay> = {}
                      Object.keys(prev).forEach(dateStr => {
                        const day = prev[dateStr]
                        // Only remove non-merged glue IDs (preserve merged glue groups)
                        const updatedBrushGlueIds: Record<number, string> = {}
                        if (day.brushGlueIds) {
                          Object.keys(day.brushGlueIds).forEach(key => {
                            const idx = parseInt(key)
                            const glueId = day.brushGlueIds![idx]
                            // Keep glue IDs that are in mergeGlueGroups (merged boxes)
                            if (glueId && mergeGlueGroups.has(glueId)) {
                              updatedBrushGlueIds[idx] = glueId
                            }
                          })
                        }
                        updatedSchedule[dateStr] = {
                          ...day,
                          brushGlueIds: Object.keys(updatedBrushGlueIds).length > 0 ? updatedBrushGlueIds : undefined,
                        }
                      })
                      return updatedSchedule
                    })
                    // Only remove non-merged glue groups
                    setGlueGroups(prev => {
                      const updated: Record<string, GlueGroup> = {}
                      Object.keys(prev).forEach(glueId => {
                        if (mergeGlueGroups.has(glueId)) {
                          updated[glueId] = prev[glueId]
                        }
                      })
                      return updated
                    })
                    setHasUnsavedChanges(true)
                  }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all font-medium text-xs bg-white ${
              isGlueMode
                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md'
                : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
            }`}
          >
            🔗 {isGlueMode ? 'Glue ON' : 'Glue'}
          </button>
          <button
            onClick={() => setSabbathMode(!sabbathMode)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all font-medium text-xs bg-white ${
              sabbathMode
                ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md'
                : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
            }`}
          >
            ☀️ {sabbathMode ? 'Sabbath ON' : 'Sabbath'}
          </button>
          <button
            onClick={() => {
              const newEditMode = !isEditMode
              setIsEditMode(newEditMode)
              setEditingDate(null)
              setEditingLabel('')
              if (newEditMode) {
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsMergeMode(false)
                setIsUnmergeMode(false)
                setIsGlueMode(false)
                setPendingMergeDates([])
                setPendingMergeSelections([])
                setPendingMergeBrushId(null)
                setPendingMergeBrushIndex(null)
              } else {
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsMergeMode(false)
                setPendingMergeDates([])
                setPendingMergeSelections([])
                setPendingMergeBrushId(null)
                setPendingMergeBrushIndex(null)
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all font-medium text-xs bg-white ${
              isEditMode
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
            }`}
          >
            ✏️ {isEditMode ? 'Edit ON' : 'Edit'}
          </button>
          <button
            onClick={() => {
              const newMergeMode = !isMergeMode
              setIsMergeMode(newMergeMode)
              setPendingMergeDates([])
              setPendingMergeSelections([])
              setPendingMergeBrushId(null)
              setPendingMergeBrushIndex(null)
              if (newMergeMode) {
                setSelectedBrush(null)
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsEditMode(false)
                setIsUnmergeMode(false)
                setIsGlueMode(false)
                setIsPaintMode(false)
                setEditingDate(null)
                setEditingLabel('')
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all font-medium text-xs bg-white ${
              isMergeMode
                ? 'border-green-500 bg-green-50 text-green-700 shadow-md'
                : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
            }`}
          >
            🔀 {isMergeMode ? 'Merge ON' : 'Merge'}
          </button>
          <button
            onClick={() => {
              const newUnmergeMode = !isUnmergeMode
              setIsUnmergeMode(newUnmergeMode)
              if (newUnmergeMode) {
                setSelectedBrush(null)
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsEditMode(false)
                setIsMergeMode(false)
                setIsGlueMode(false)
                setIsPaintMode(false)
                setPendingMergeDates([])
                setPendingMergeSelections([])
                setPendingMergeBrushId(null)
                setPendingMergeBrushIndex(null)
                setEditingDate(null)
                setEditingLabel('')
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all font-medium text-xs bg-white ${
              isUnmergeMode
                ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md'
                : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:shadow-sm'
            }`}
          >
            🔓 {isUnmergeMode ? 'Unmerge ON' : 'Unmerge'}
          </button>
          {isMergeMode && pendingMergeSelections.length >= 2 && (
            <button
              onClick={handleConfirmMerge}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium transition-all text-xs shadow-md"
            >
              ✓ Confirm Merge
            </button>
          )}

          <div className="h-6 w-px bg-slate-300"></div>

          {/* Undo / Redo / Hand / Soap / Clear - emoji-only compact */}
          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm hover:shadow-sm"
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 hover:border-slate-400 bg-white text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm hover:shadow-sm"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↷
          </button>
          <button
            onClick={() => {
              const on = !isCopyPasteMode
              setIsCopyPasteMode(on)
              if (on) {
                setCopyPasteCaptured(null)
                setIsEraserMode(false)
                setIsGlueMode(false)
                setIsMergeMode(false)
                setIsUnmergeMode(false)
                setIsEditMode(false)
                setSelectedBrush(null)
              }
            }}
            className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-base ${
              isCopyPasteMode ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
            title={copyPasteCaptured ? 'Click a cell to paste' : 'Click a block to copy color + label'}
          >
            🫳
          </button>
          <button
            onClick={() => {
              const on = !isEraserMode
              setIsEraserMode(on)
              if (on) {
                setIsCopyPasteMode(false)
                setCopyPasteCaptured(null)
                setIsGlueMode(false)
                setIsMergeMode(false)
                setIsUnmergeMode(false)
                setIsEditMode(false)
                setSelectedBrush(null)
                setIsPaintMode(false)
              }
            }}
            className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-base ${
              isEraserMode ? 'border-red-500 bg-red-50 shadow-sm' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
            title="Tap a block to delete it"
          >
            🧼
          </button>
          <div className="flex-shrink-0 flex items-center gap-1">
            <button
              onClick={() => {
                const on = !isPaintMode
                setIsPaintMode(on)
                if (on) {
                  setIsCopyPasteMode(false)
                  setCopyPasteCaptured(null)
                  setIsEraserMode(false)
                  setIsMergeMode(false)
                  setIsUnmergeMode(false)
                  setIsEditMode(false)
                  setSelectedBrush(null)
                }
              }}
              className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border-2 transition-all text-base ${
                isPaintMode ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-300 hover:border-slate-400 bg-white'
              }`}
              title="Select a color, then click blocks to change their color"
            >
              🖌️
            </button>
            {isPaintMode && (
              <input
                type="color"
                value={paintColor}
                onChange={(e) => setPaintColor(e.target.value)}
                className="w-8 h-8 rounded-lg border-2 border-slate-300 cursor-pointer p-0"
                title="Pick color"
              />
            )}
          </div>
          <button
            onClick={handleClearAll}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-red-300 hover:border-red-400 bg-white hover:bg-red-50 text-red-600 transition-all text-sm hover:shadow-sm"
            title="Clear all"
          >
            🗑️
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {isSaving ? 'Saving...' : hasUnsavedChanges ? '💾 Save' : '✓ Saved'}
          </button>
          {false && (
            <button
              onClick={handleExportToExcel}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium transition-all text-xs shadow-md"
              title="Export calendar to Excel (CSV)"
            >
              📊 Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Title - Minimal header */}
      <div className="pb-4 px-4 pt-16">
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent text-center">
          {currentTimelineTitle || 'AI Production Schedule Maker'}
        </h2>
      </div>

      {/* Calendar - Multi-month scrollable view */}
      <div className="bg-white rounded-xl p-4 md:p-6 border border-gray-200 shadow-lg mx-4 mb-4" data-calendar-container>
          <div className="flex items-center justify-center mb-4">
          <div className="text-center">
            <h3 className="text-lg md:text-xl font-bold text-gray-800">
              {visibleMonths.length === 1 
                ? format(visibleMonths[0], 'MMMM yyyy')
                : `${format(visibleMonths[0], 'MMM yyyy')} - ${format(visibleMonths[visibleMonths.length - 1], 'MMM yyyy')}`
              }
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {visibleMonths.length} month{visibleMonths.length !== 1 ? 's' : ''} visible
            </p>
          </div>
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2" style={{ scrollBehavior: 'smooth' }}>
          {/* Add Previous Month button at the start */}
          <div className="flex justify-center">
            <button
              onClick={addPreviousMonth}
              className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs md:text-sm transition-all"
            >
              + Add Previous Month
            </button>
          </div>
          
          {allCalendarDays.map(({ month, days, emptyCellsAtStart, emptyCellsAtEnd }, monthIdx) => {
            const isFirstMonth = monthIdx === 0
            const isLastMonth = monthIdx === allCalendarDays.length - 1
            
            return (
              <div key={format(month, 'yyyy-MM')} className="transition-all duration-300 ease-in-out">
                {/* Month header */}
                <div className="sticky top-0 bg-white z-10 py-3 mb-3">
                  <h4 className="text-base md:text-lg font-semibold text-gray-800">
                    {format(month, 'MMMM yyyy')}
                  </h4>
                </div>
                
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                  {/* Sticky day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="sticky top-0 bg-white z-20 text-center font-semibold text-gray-600 py-2 text-xs md:text-sm border-b border-gray-200">
                      {day}
                    </div>
                  ))}

                  {/* Empty cells at the start of the month to align with day of week */}
                  {Array.from({ length: emptyCellsAtStart }).map((_, idx) => (
                    <div
                      key={`empty-start-${idx}`}
                      className="aspect-square min-h-[40px] md:min-h-[50px]"
                    />
                  ))}

                  {/* Only show dates that belong to this month */}
                  {days.map((date, idx) => {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const day = getScheduleDay(dateStr)
                    const isCurrentDay = isToday(date)
                    
                    // Check if this date is part of a merged glue group (for visual rendering)
                    // Check all brush indices to see if any have a merged glue ID
                    const brushGlueIds = day.brushGlueIds || {}
                    let glueId: string | undefined = undefined
                    // Find the first brush index that has a merged glue ID
                    for (let i = 0; i < day.brushes.length; i++) {
                      const gId = brushGlueIds[i]
                      if (gId && mergeGlueGroups.has(gId)) {
                        glueId = gId
                        break
                      }
                    }
                    const isMergedGlue = glueId !== undefined
                    const mergedGlueGroup = isMergedGlue && glueId && glueGroups[glueId] ? glueGroups[glueId] : null
                    
                    // Check if dates are actually consecutive (accounting for weekends)
                    let isActuallyMerged = false
                    let consecutiveRanges: string[][] = []
                    let isFirstInMerge = false
                    let isLastInMerge = false
                    
                    if (isMergedGlue && mergedGlueGroup && mergedGlueGroup.dates.length > 1) {
                      // Group dates into consecutive ranges
                      const sortedDates = [...mergedGlueGroup.dates].sort()
                      let currentRange: string[] = [sortedDates[0]]
                      
                      for (let i = 1; i < sortedDates.length; i++) {
                        const prev = new Date(sortedDates[i - 1])
                        const curr = new Date(sortedDates[i])
                        const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
                        
                        if (sabbathMode) {
                          // In Sabbath mode, Friday->Monday is consecutive (skip weekend)
                          const prevDayOfWeek = prev.getDay()
                          const currDayOfWeek = curr.getDay()
                          const isConsecutive = (prevDayOfWeek === 5 && currDayOfWeek === 1 && diffDays === 3) || 
                                                (diffDays === 1 && prevDayOfWeek >= 1 && prevDayOfWeek <= 5 && currDayOfWeek >= 1 && currDayOfWeek <= 5)
                          
                          if (isConsecutive) {
                            currentRange.push(sortedDates[i])
                          } else {
                            consecutiveRanges.push(currentRange)
                            currentRange = [sortedDates[i]]
                          }
                        } else {
                          // Sabbath mode OFF: smart weekend splitting
                          const prevDayOfWeek = prev.getDay()
                          const currDayOfWeek = curr.getDay()
                          
                          // Saturday (6) is ALWAYS separate - never merges with anything
                          // Sunday (0) can merge with Monday (1) if consecutive
                          // Other consecutive weekdays merge together
                          const prevIsSaturday = prevDayOfWeek === 6
                          const currIsSaturday = currDayOfWeek === 6
                          const prevIsSunday = prevDayOfWeek === 0
                          const currIsSunday = currDayOfWeek === 0
                          
                          // Check if there's a weekend between dates
                          const hasWeekendBetween = (prevDayOfWeek === 5 && currDayOfWeek === 0) || // Fri -> Sun (Sat in between)
                                                   (prevDayOfWeek === 6 && currDayOfWeek === 1)   // Sat -> Mon (Sun in between)
                          
                          // Smart merging logic:
                          // - Saturday is ALWAYS separate (never merges)
                          // - Sunday can merge with Monday if consecutive (Sun->Mon is allowed)
                          // - Friday->Sunday breaks (Saturday in between)
                          // - Saturday->Monday breaks (Sunday in between)
                          // - Other consecutive weekdays merge
                          
                          if (prevIsSaturday || currIsSaturday || hasWeekendBetween) {
                            // Saturday involved or weekend between - always start new range
                            consecutiveRanges.push(currentRange)
                            currentRange = [sortedDates[i]]
                          } else if (diffDays === 1) {
                            // Consecutive days - merge together
                            // This allows Sunday->Monday to merge
                            currentRange.push(sortedDates[i])
                          } else {
                            // More than 1 day apart - start new range
                            consecutiveRanges.push(currentRange)
                            currentRange = [sortedDates[i]]
                          }
                        }
                      }
                      consecutiveRanges.push(currentRange)
                      
                      // Find which range contains this date
                      const rangeContainingThisDate = consecutiveRanges.find(range => range.includes(dateStr))
                      if (rangeContainingThisDate) {
                        isActuallyMerged = rangeContainingThisDate.length > 1
                        isFirstInMerge = rangeContainingThisDate[0] === dateStr
                        isLastInMerge = rangeContainingThisDate[rangeContainingThisDate.length - 1] === dateStr
                      }
                    }
                    
                    const isPendingMerge = isMergeMode && pendingMergeDates.includes(dateStr)
                    // Check which specific stripes are selected for merging
                    const pendingMergeStripeIndices = isMergeMode 
                      ? pendingMergeSelections.filter(s => s.dateStr === dateStr).map(s => s.brushIndex)
                      : []

                    return (
                      <div
                        key={`${format(month, 'yyyy-MM')}-${idx}`}
                        data-date={dateStr}
                        onClick={(e) => handleClick(date, e)}
                        onMouseDown={(e) => handleMouseDown(date, e)}
                        onMouseEnter={() => handleMouseEnter(date)}
                        onMouseUp={(e) => {
                          // Handle drop on this specific date
                          // Allow drop if dragging OR if we have multiple connected dates (for easier repositioning)
                          const hasMultipleConnectedDates = dragState.current.connectedDates && dragState.current.connectedDates.length > 1
                          const isDifferentDate = dragState.current.startDate && dragState.current.startDate !== dateStr
                          // More lenient: allow drop if we have source brushes and are on a different date
                          // OR if we're actually dragging/holding
                          const shouldHandleDrop = isGlueMode && 
                                                  dragState.current.sourceBrushes && 
                                                  dragState.current.sourceBrushes.length > 0 &&
                                                  (dragState.current.isDragging || dragState.current.isHolding || hasMultipleConnectedDates || isDifferentDate)
                          
                          if (shouldHandleDrop) {
                            e.stopPropagation() // Prevent global handler from also firing
                            handleMouseUp(date)
                          }
                        }}
                        className={`
                          aspect-square transition-all min-h-[40px] md:min-h-[50px] relative
                          ${isActuallyMerged 
                            ? `${isFirstInMerge ? 'rounded-l border-l border-t border-b' : isLastInMerge ? 'rounded-r border-r border-t border-b' : 'border-t border-b'} border-gray-300`
                            : 'rounded border border-gray-300'
                          }
                          bg-white hover:bg-gray-50
                          ${isCurrentDay ? 'ring-2 ring-purple-500' : ''}
                          ${day.brushGlueIds && Object.keys(day.brushGlueIds).length > 0 ? 'ring-1 ring-yellow-400' : ''}
                          ${isPendingMerge ? 'ring-1 ring-green-300' : ''}
                          ${selectedBrush && !isGlueMode && !isEditMode && !isMergeMode ? 'hover:opacity-80 cursor-pointer' : ''}
                          ${isEditMode && day.brushes.length > 0 ? 'cursor-pointer' : ''}
                          ${isMergeMode ? 'cursor-pointer' : ''}
                          ${isGlueMode && !isEditMode && !isMergeMode && day.brushes.length > 0 ? 'cursor-grab' : isGlueMode && !isEditMode && !isMergeMode ? 'cursor-pointer' : ''}
                          ${isGlueMode && dragState.current.isDragging && dragState.current.sourceBrushes && dragState.current.startDate !== dateStr ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
                          ${isGlueMode && dragState.current.startDate === dateStr && (dragState.current.isHolding || isDraggingState) ? 'scale-95 opacity-50 transition-transform duration-150' : ''}
                          ${isGlueMode && dragState.current.connectedDates && dragState.current.connectedDates.some(cd => cd.dateStr === dateStr) && (dragState.current.isHolding || isDraggingState) ? 'scale-95 opacity-50 transition-transform duration-150' : ''}
                        `}
                        style={{
                          pointerEvents: 'auto',
                        }}
                      >
                        <div className="p-0.5 md:p-1 text-xs md:text-sm font-bold z-10 relative pointer-events-none text-black">
                          {format(date, 'd')}
                        </div>
                        
                        {/* Render stripes - individual stripes handle their own visibility during drag */}
                        {renderDateStripes(day, dateStr)}
                        
                        {/* Glue icon is now shown per-stripe in renderDateStripes */}
                      </div>
                    )
                  })}

                  {/* Empty cells at the end of the month to complete the grid */}
                  {Array.from({ length: emptyCellsAtEnd }).map((_, idx) => (
                    <div
                      key={`empty-end-${idx}`}
                      className="aspect-square min-h-[40px] md:min-h-[50px]"
                    />
                  ))}
                </div>
              </div>
            )
          })}
          
          {/* Add Next Month button at the end */}
          <div className="flex justify-center">
            <button
              onClick={addNextMonth}
              className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs md:text-sm transition-all"
            >
              + Add Next Month
            </button>
          </div>
        </div>
      </div>

      {/* Drag Preview - shows the dragged date box(es) following the mouse */}
      {isGlueMode && isDraggingState && dragState.current.sourceBrushes && dragState.current.sourceBrushes.length > 0 && dragPreviewPos && (
        <>
          {/* Main dragged box */}
          <div
            className="fixed pointer-events-none z-50"
            style={{
              left: dragPreviewPos.x - 25,
              top: dragPreviewPos.y - 25,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-[50px] h-[50px] rounded border-2 border-purple-500 shadow-2xl bg-white dark:bg-gray-800 relative overflow-hidden">
              <div className="absolute inset-0 flex flex-col">
                {dragState.current.sourceBrushes.map((brushId, index) => {
                  const brush = brushes.find(b => b.id === brushId)
                  if (!brush) return null
                  const stripeHeight = 100 / dragState.current.sourceBrushes!.length
                  return (
                    <div
                      key={`${brushId}-${index}`}
                      className="flex items-center justify-center px-1"
                      style={{
                        height: `${stripeHeight}%`,
                        backgroundColor: brush.color,
                        color: '#fff',
                      }}
                    >
                      <span className="text-[8px] font-medium truncate">{brush.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          
          {/* Show preview of all connected dates maintaining relative spacing */}
          {/* Works for any number of connected dates (3, 4, 5, up to 30+) */}
          {dragState.current.connectedDates && dragState.current.connectedDates.length > 1 && dragState.current.sourceDateStr && (
            <>
              {dragState.current.connectedDates
                .filter(cd => cd.dateStr !== dragState.current.sourceDateStr)
                .map((connectedDate, idx) => {
                  const sourceDate = new Date(dragState.current.sourceDateStr!)
                  sourceDate.setHours(0, 0, 0, 0)
                  const connectedDateObj = new Date(connectedDate.dateStr)
                  connectedDateObj.setHours(0, 0, 0, 0)
                  
                  // Calculate days difference more accurately
                  const daysFromSource = Math.round((connectedDateObj.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24))
                  
                  // Calculate position relative to main drag preview, maintaining spacing
                  // Use compact spacing (50px per day) to fit more dates on screen
                  const spacingOffset = daysFromSource * 50 // 50px per day spacing (reduced from 60px for better visibility with many dates)
                  
                  const brush = brushes.find(b => b.id === connectedDate.brushId)
                  if (!brush) return null
                  
                  // For dates far from source, reduce opacity slightly to show hierarchy
                  const distanceOpacity = Math.abs(daysFromSource) > 7 ? 0.5 : 0.7
                  
                  return (
                    <div
                      key={`connected-${connectedDate.dateStr}-${connectedDate.brushIndex}`}
                      className="fixed pointer-events-none z-50"
                      style={{
                        left: dragPreviewPos.x - 25 + spacingOffset,
                        top: dragPreviewPos.y - 25,
                        transform: 'translate(-50%, -50%)',
                        opacity: distanceOpacity,
                      }}
                    >
                      <div className="w-[50px] h-[50px] rounded border-2 border-yellow-400 shadow-xl bg-white dark:bg-gray-800 relative overflow-hidden">
                        <div className="absolute inset-0 flex flex-col">
                          <div
                            className="flex items-center justify-center px-1"
                            style={{
                              height: '100%',
                              backgroundColor: brush.color,
                              color: '#fff',
                            }}
                          >
                            <span className="text-[8px] font-medium truncate">{brush.name}</span>
                            <div className="absolute top-0.5 right-0.5 text-yellow-500 text-[8px]">🔗</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </>
          )}
        </>
      )}

      {/* Brush Creator Modal */}
      {showBrushCreator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold mb-4">Create New Brush</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Brush Name</label>
                <input
                  type="text"
                  value={newBrushName}
                  onChange={(e) => setNewBrushName(e.target.value)}
                  placeholder="e.g., Creative Review, Client Meeting"
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBrush()
                    }
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {colorPalette.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewBrushColor(color)}
                      className={`w-10 h-10 rounded border-2 ${
                        newBrushColor === color
                          ? 'border-purple-600 ring-2 ring-purple-300'
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={newBrushColor}
                  onChange={(e) => setNewBrushColor(e.target.value)}
                  className="mt-2 w-full h-10 rounded"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowBrushCreator(false)
                  setNewBrushName('')
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBrush}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">🤖 AI Assistant</h3>

            {pendingAIResult ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {pendingAIResult.kind === 'recognize'
                    ? 'OpenAI returned a list of blocks and which days they cover. "day X to day Y" = merged block. You can edit it below, then click "Confirm & populate timeline".'
                    : 'Review what we sent to OpenAI and what came back. If it looks correct, click "Apply to timeline".'}
                </p>
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-blue-50 dark:bg-blue-900/20 p-3 mb-3">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">What we sent to OpenAI</label>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-1">{pendingAIResult.sentToOpenAI.prompt || '(no text prompt)'}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {pendingAIResult.sentToOpenAI.imageCount > 0
                      ? `${pendingAIResult.sentToOpenAI.imageCount} PDF page(s) sent as images`
                      : 'No images sent'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 mb-4">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    What OpenAI returned{pendingAIResult.kind === 'recognize' ? ' (simple writing – edit in box below)' : ' (schedule data)'}
                  </label>
                  <pre className="text-xs overflow-auto max-h-[20vh] whitespace-pre-wrap break-words font-mono text-gray-800 dark:text-gray-200 mt-2 mb-3">
                    {pendingAIResult.kind === 'recognize' ? pendingAIResult.summary : pendingAIResult.rawResponse}
                  </pre>
                  {pendingAIResult.kind === 'recognize' && (
                    <>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Text to send (edit here, then Confirm & populate)</label>
                      <textarea
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        placeholder="Edit the text above, then click Confirm & populate timeline"
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPendingAIResult(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  {pendingAIResult.kind === 'recognize' ? (
                    <button
                      onClick={handleConfirmAndPopulate}
                      disabled={isAILoading || !aiInput.trim()}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAILoading ? 'Populating...' : 'Confirm & populate timeline'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        applyAIScheduleToTimeline(pendingAIResult.schedule)
                        setPendingAIResult(null)
                        setShowAIModal(false)
                        setAiInput('')
                        setPdfPageImages([])
                        setPdfFileName('')
                        setAiError(null)
                      }}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium"
                    >
                      Apply to timeline
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  {/* PDF upload for calendar import */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Upload a PDF calendar (optional)
                    </label>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handlePdfUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isAILoading || isPdfLoading}
                        className="px-4 py-2 rounded-lg border-2 border-dashed border-gray-400 dark:border-gray-500 hover:border-purple-500 dark:hover:border-purple-400 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-all text-sm disabled:opacity-50"
                      >
                        {isPdfLoading ? 'Reading PDF...' : '📄 Choose PDF'}
                      </button>
                      {pdfFileName && (
                        <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                          <span className="truncate max-w-[180px]" title={pdfFileName}>{pdfFileName}</span>
                          <button
                            type="button"
                            onClick={clearPdf}
                            disabled={isAILoading}
                            className="text-red-500 hover:text-red-600 text-xs"
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Each page is sent to OpenAI so the AI can see your calendar and turn dates and activities into colored stripes.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {pdfPageImages.length > 0 ? 'Additional notes (optional)' : 'Describe your schedule'}
                    </label>
                    <textarea
                      value={aiInput}
                      onChange={(e) => {
                        setAiInput(e.target.value)
                        setAiError(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isAILoading) {
                          if (aiInput.trim() || pdfPageImages.length > 0) {
                            e.preventDefault()
                            handleAIGenerate()
                          }
                        }
                      }}
                      placeholder={pdfPageImages.length > 0 
                        ? "Optional: Add notes about the PDF calendar..."
                        : "Describe your schedule, for example:\n\nDESIGN from Monday Feb 2 to Friday Feb 6\nAWARD on Monday Feb 2\nMOTION TESTS Wed Feb 4 to Fri Feb 6\n\nPress Enter to generate..."}
                      rows={8}
                      disabled={isAILoading}
                      autoFocus={pdfPageImages.length === 0}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {pdfPageImages.length > 0 
                        ? 'The AI will read your PDF and list each day. You can review and edit before applying.'
                        : 'Press Enter to generate - Shift+Enter for new line'}
                    </p>
                  </div>

                  {aiError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
                    </div>
                  )}

                  {isAILoading && (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Building your schedule...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAIModal(false)
                      setPendingAIResult(null)
                      setAiInput('')
                      setPdfPageImages([])
                      setPdfFileName('')
                      setAiError(null)
                    }}
                    disabled={isAILoading}
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleAIGenerate}
                    disabled={isAILoading || (!aiInput.trim() && pdfPageImages.length === 0)}
                    className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAILoading ? 'Generating...' : 'Import & generate schedule'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

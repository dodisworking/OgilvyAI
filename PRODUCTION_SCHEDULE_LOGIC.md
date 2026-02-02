# Production Schedule Maker - Logic & Architecture Documentation

## Overview
This document captures the current logic and architecture of the ProductionScheduleMaker component to preserve understanding before adding new features.

## Core Data Structures

### Interfaces
- **Brush**: `{ id, name, color, isDefault? }` - Represents a task type/color
- **ScheduleDay**: 
  - `date: string` (YYYY-MM-DD)
  - `brushes: string[]` - Array of brush IDs (top to bottom, creates horizontal stripes)
  - `brushGlueIds?: Record<number, string>` - Map of brush index → glue group ID
  - `customLabels?: Record<number, string>` - Map of brush index → custom label
- **GlueGroup**: `{ id, dates: string[] }` - Groups dates that are "glued" together
- **MergeGroup**: (Interface exists but merged blocks use GlueGroups + mergeGlueGroups Set)

### State Management

#### Core State
- `schedule: Record<string, ScheduleDay>` - Main schedule data
- `glueGroups: Record<string, GlueGroup>` - All glue groups (both temporary and merged)
- `mergeGlueGroups: Set<string>` - Tracks which glue group IDs are "merged" (permanent visual blocks)
- `brushes: Brush[]` - Available brushes/task types
- `activeGlueGroupId: string | null` - Current glue group being built

#### Mode States (Mutually Exclusive)
- `isGlueMode: boolean` - Glue mode (connect dates)
- `isMergeMode: boolean` - Merge mode (create permanent merged blocks)
- `isUnmergeMode: boolean` - Unmerge mode (split merged blocks)
- `isEditMode: boolean` - Edit mode (change labels)
- `selectedBrush: string | null` - Selected brush for painting

#### UI States
- `editingDate: { dateStr, brushIndex } | null` - Currently editing date/brush
- `editingLabel: string` - Current label being edited
- `pendingMergeDates: string[]` - Dates selected for merging
- `sabbathMode: boolean` - Skip weekends when merging/dragging
- `visibleMonths: Date[]` - Months currently displayed
- `currentTimelineId: string | null` - Active timeline ID
- `hasUnsavedChanges: boolean` - Track if save needed

#### History/Undo
- `history: Array<{ schedule, glueGroups }>` - Undo history
- `historyIndex: number` - Current position in history (-1 = no history)
- `maxHistorySize: 50` - Limit history entries

## Key Logic Flows

### 1. Painting (Adding Brushes)
**Flow**: Select brush → Click date → `addBrushToDate()`
- Adds brush ID to `day.brushes[]` array
- Creates horizontal stripe (top to bottom order)
- If not in glue mode, removes glue links
- Toggle behavior: clicking same brush removes it

### 2. Glue Mode
**Purpose**: Connect dates together (temporary or permanent)

**Activation**: Click Glue button → `setIsGlueMode(true)` → Clears other modes

**Behavior**:
- Click on date with brush → Creates/joins glue group
- Click on glued date → Removes glue (unglues)
- Click on merged block → Unmerges it (removes merge)
- Drag in glue mode → Moves connected dates together (smart calendar mover)

**Glue Groups**:
- Created with ID: `glue-${Date.now()}`
- Stored in `glueGroups` object
- Each date's `brushGlueIds[index] = glueGroupId`
- Can be temporary (removed when glue mode off) or permanent (merged)

### 3. Merge Mode
**Purpose**: Create permanent merged visual blocks

**Activation**: Click Merge button → `setIsMergeMode(true)` → Clears other modes

**Flow**:
1. Click dates to select (must be consecutive, same brush at index 0)
2. Dates stored in `pendingMergeDates[]`
3. Click "Confirm Merge" → `handleConfirmMerge()`
4. Creates glue group with ID: `merge-glue-${Date.now()}`
5. Adds glue ID to `mergeGlueGroups` Set (marks as merged)
6. Updates all dates with `brushGlueIds[0] = glueGroupId`

**Visual Rendering**:
- Merged blocks span across consecutive dates
- Weekend breaks split merged blocks (unless Sabbath mode)
- Only first date in range renders the merged block
- Other dates in range return `null` (hidden)

### 4. Unmerge Mode
**Purpose**: Split merged blocks back into individual dates

**Activation**: Click Unmerge button → `setIsUnmergeMode(true)` → Clears other modes

**Flow**:
1. Click on merged block → `handleUnmergeClick()`
2. Finds merged glue ID from `mergeGlueGroups` Set
3. Removes glue ID from `mergeGlueGroups`
4. Removes glue IDs from all dates in group
5. Deletes glue group

**Also works in Glue Mode**: Clicking merged block in glue mode unmerges it

### 5. Edit Mode
**Purpose**: Change custom labels on brushes

**Activation**: Click Edit button → `setIsEditMode(true)` → Clears other modes

**Flow**:
1. Click on stripe → Sets `editingDate` and `editingLabel`
2. Input field appears with checkmark button below
3. Click checkmark or press Enter → `handleSaveLabel()`
4. Saves to `day.customLabels[brushIndex] = label`
5. Press Escape → Cancels editing

### 6. Drag & Drop (Glue Mode)
**Purpose**: Move connected dates together

**Flow**:
1. Mouse down on stripe → `handleStripeMouseDown()`
2. Detects if date has glue connections
3. If connected, finds all `connectedDates` via glue IDs
4. On drag → Shows preview, tracks mouse position
5. On drop → `handleMouseUp()` with target date
6. Calculates relative spacing between connected dates
7. Moves all connected dates maintaining spacing
8. Updates glue group with new dates
9. Removes brushes from old locations, adds to new

**Smart Calendar Mover**:
- Maintains relative spacing between connected dates
- Handles weekend skipping (Sabbath mode)
- Uses anchor date (clicked date) as reference point

### 7. Weekend Handling (Sabbath Mode)
**When OFF**: Weekends break consecutive chains
- Friday → Sunday = NOT consecutive
- Saturday → Monday = NOT consecutive

**When ON**: Weekends are skipped
- Friday → Monday = consecutive (skips Sat/Sun)
- Only weekdays can be merged/glued

**Helper**: `areConsecutiveDatesWithWeekendCheck()`

### 8. History/Undo System
**Flow**:
- Before any modification → `saveToHistory()`
- Deep clones schedule and glueGroups
- Stores in `history[]` array
- Limits to 50 entries (removes oldest)
- Undo: `handleUndo()` - Goes back in history
- Redo: `handleRedo()` - Goes forward in history
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z (redo)

### 9. Save/Load System
**Save**: `handleSave()`
- Sends to `/api/production-schedule` (PUT)
- Includes: `schedule`, `glueGroups`, `mergeGlueGroups` (as array)
- Sets `hasUnsavedChanges = false` on success

**Load**: `loadTimeline(timelineId)`
- Fetches from `/api/production-schedule` (GET)
- Restores: `schedule`, `glueGroups`, `mergeGlueGroups` (converts array to Set)
- Sets `currentTimelineId` and `currentTimelineTitle`

## Mode Interactions (Mutually Exclusive)

When activating any mode, it clears others:
- **Glue** → Clears: Merge, Unmerge, Edit
- **Merge** → Clears: Glue, Unmerge, Edit
- **Unmerge** → Clears: Glue, Merge, Edit
- **Edit** → Clears: Merge (but not Glue/Unmerge explicitly)

## Visual Rendering Logic

### Calendar Grid
- Multi-month scrollable view
- Each month shows only its own dates (no overflow)
- Empty cells at start/end for week alignment

### Stripe Rendering
- Each brush in `day.brushes[]` creates a horizontal stripe
- Height calculated: `100% / brushes.length`
- Colors from brush definition
- Labels: Custom label OR brush name

### Merged Block Rendering
- Only renders on first date of consecutive range
- Width: `calc(${mergeSpan} * 100% + ${(mergeSpan - 1) * 4}px)`
- Position: `absolute` with `left: 0`
- Other dates in range return `null` (hidden)
- Weekend breaks create separate merged blocks

### Glue Indicator
- Yellow 🔗 icon on glued stripes (when not editing)
- Position: `absolute top-0.5 right-0.5`

## Key Helper Functions

- `getScheduleDay(dateStr)`: Gets schedule day or returns empty day
- `areConsecutiveDates(dateStrings)`: Checks if dates are consecutive
- `areConsecutiveDatesWithWeekendCheck(dateStrings, sabbathMode)`: Checks with weekend logic
- `deepCloneSchedule(schedule)`: Deep clones for history
- `deepCloneGlueGroups(groups)`: Deep clones glue groups
- `ensureWeekday(date)`: Ensures date is weekday (for Sabbath mode)
- `getNextValidDate(date, direction, sabbathMode)`: Gets next valid date skipping weekends

## Current Features Summary

✅ Multi-month calendar view
✅ Brush painting (horizontal stripes)
✅ Glue mode (connect dates)
✅ Merge mode (permanent merged blocks)
✅ Unmerge mode (split merged blocks)
✅ Edit mode (custom labels with checkmark confirmation)
✅ Drag & drop (smart calendar mover)
✅ Sabbath mode (weekend skipping)
✅ Undo/Redo (50 entry history)
✅ Save/Load timelines
✅ Custom brushes
✅ Visual indicators (glue icon, merged blocks)

## Important Notes

1. **Merged blocks are glue groups**: Merged blocks use the same glue group system, just marked in `mergeGlueGroups` Set
2. **Weekend splitting**: Merged blocks automatically split at weekends (unless Sabbath mode)
3. **Per-stripe glue**: Each brush index can have its own glue ID (horizontal splitting)
4. **History before changes**: Always calls `saveToHistory()` before modifications
5. **Event propagation**: Careful use of `stopPropagation()` to prevent conflicts
6. **Drag vs Click**: Tracks `mouseMoved` to distinguish drags from clicks

## Data Flow Example

**Merging 3 dates**:
1. User clicks Merge button → `isMergeMode = true`
2. User clicks 3 consecutive dates → `pendingMergeDates = ['2024-01-01', '2024-01-02', '2024-01-03']`
3. User clicks "Confirm Merge" → `handleConfirmMerge()`
4. Creates glue group: `{ id: 'merge-glue-1234', dates: [...] }`
5. Adds to `mergeGlueGroups` Set: `Set(['merge-glue-1234'])`
6. Updates schedule:
   - `schedule['2024-01-01'].brushGlueIds[0] = 'merge-glue-1234'`
   - `schedule['2024-01-02'].brushGlueIds[0] = 'merge-glue-1234'`
   - `schedule['2024-01-03'].brushGlueIds[0] = 'merge-glue-1234'`
7. Visual: Only first date renders merged block spanning 3 dates

**Unmerging**:
1. User clicks Unmerge button → `isUnmergeMode = true`
2. User clicks merged block → `handleUnmergeClick()`
3. Finds glue ID: `'merge-glue-1234'`
4. Removes from `mergeGlueGroups` Set
5. Removes `brushGlueIds[0]` from all 3 dates
6. Deletes glue group
7. Visual: 3 separate blocks appear

---

*This documentation preserves the current state of the ProductionScheduleMaker component logic as of the latest changes.*

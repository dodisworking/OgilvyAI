import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

// POST - Generate schedule from AI prompt
export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (parseError: any) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError.message },
        { status: 400 }
      )
    }

    const { prompt, currentMonth, brushes, images: imageUrls } = body
    const hasPrompt = prompt && typeof prompt === 'string' && prompt.trim() !== ''
    const hasImages = Array.isArray(imageUrls) && imageUrls.length > 0

    if (!hasPrompt && !hasImages) {
      return NextResponse.json(
        { error: 'Prompt or calendar images are required' },
        { status: 400 }
      )
    }

    const finalPrompt = hasPrompt
      ? prompt.trim()
      : 'Take a look at this calendar. (1) Each column is one date—if Sunday\'s column is empty, do not put anything on Sunday; if a block is in Monday\'s column it is Monday only. (2) Write out the days of the month and identify labels and blocks per date and day of week; if a block has no label but continues from the previous day, treat it as a merged continuation. (3) There can be multiple merged blocks (e.g. one bar spanning days 16–18, another spanning 20–22)—track each separately. (4) Use the exact labels from the calendar (e.g. "ANIMATION", "ANIM R3 EOD") so merged blocks are labeled correctly. Return the schedule in the exact JSON format with correct dates and mergeWithPrevious where needed.'

    // Get current year from currentMonth or default to current year
    const currentYear = currentMonth 
      ? new Date(currentMonth).getFullYear()
      : new Date().getFullYear()

    // Build list of available activity names from brushes
    const activityNames = (brushes || []).map((b: any) => b.name).join(', ')

    // System prompt that explains the schedule structure and required format
    const systemPrompt = `You are an AI assistant that helps create production schedules for different types of productions.

The user has a calendar-based production schedule application where:
- Each day (date in YYYY-MM-DD format) can have multiple "stripes" (activities) stacked vertically
- Each stripe has an activity type (from a predefined list) and an optional custom label
- Activities can be "merged" across consecutive days to show a continuous block (like "Production runs Jan 15-20")

Available activity types: ${activityNames || 'Creative Review, Client Meeting, Production, Post-Production, Pre-Production, VFX, Audio Mix, Color Grade'}

PRODUCTION TYPE DETECTION & TERMINOLOGY:
You must detect the production type from the user's prompt and use appropriate terminology and common milestones:

**RADIO PRODUCTION:**
- Common phases: Script Writing, Voice Recording, Audio Editing, Sound Design, Music Composition, Mixing, Mastering, Final Delivery
- Typical milestones: Script Approval, Voice Talent Booking, Recording Session, Rough Mix, Client Review, Final Mix, Broadcast Ready
- Use radio-specific terminology: "Voice Over", "Audio Mix", "Sound Design", "Music Bed", "Spot Production", "Radio Spot", "Commercial Production"

**ANIMATION PRODUCTION:**
- Common phases: Concept Development, Character Design, Storyboard, Layout, Animation, Cleanup, Color, Compositing, Post-Production
- Typical milestones: Design Lock, Storyboard Approval, Animation Lock, Color Lock, Final Render, Delivery
- Use animation-specific terminology: "Design Phase", "Animation Lock", "Color Design", "Rigging", "Keyframe Animation", "Inbetweening", "Cleanup", "Compositing", "Render"

**LIVE ACTION PRODUCTION:**
- Common phases: Pre-Production, Production/Shoot, Post-Production, VFX, Color Grading, Audio Post, Final Delivery
- Typical milestones: Script Lock, Location Scout, Casting, Shoot Dates, Picture Lock, VFX Lock, Color Grade, Final Mix, Delivery
- Use live action terminology: "Principal Photography", "Shoot Day", "Dailies", "Picture Lock", "Color Grade", "Online Edit", "Offline Edit"

**GENERAL PRODUCTION (if type not specified):**
- Use standard terminology: Pre-Production, Production, Post-Production, Creative Review, Client Approval, Final Delivery

Your task:
1. The user may provide images of a calendar or production schedule (one image per PDF page). Follow the process below to get dates and merged blocks right, then return the schedule in the exact JSON format.

WHEN THE USER SENDS CALENDAR IMAGES — DO THIS FIRST (in your reasoning):
Step A — COLUMN = ONE DATE. Each vertical column in the calendar is exactly one day. The number at the top of the column is the day-of-month (e.g. 16, 17, 18). Identify which day-of-week each column is (e.g. from left to right: Sunday, Monday, Tuesday … or whatever the calendar shows). If Sunday's column is empty, do NOT put any activity on Sunday. If a block appears in Monday's column, it belongs to Monday only—never assign it to Sunday. Build YYYY-MM-DD from the calendar's month/year and the day-of-month; verify day-of-week matches the column.
Step B — For each date (each column), list what appears in that column only:
  (1) Every label and block: write down the exact text from the calendar (e.g. "ANIMATION", "ANIM R3 EOD", "HOLIDAY") and which date and day-of-week that column is.
  (2) If a block in a column has NO label (same-colored bar continuing from the previous column), it is a merged continuation—note which labeled bar it continues (same label as the bar that started on the previous day).
Step C — There can be MULTIPLE merged blocks. Track each spanning bar separately by its label and row/position. When a NEW bar with a different label starts on a day (e.g. "DELIVERY & TECH CHECK" on Thursday 19), the PREVIOUS bar (e.g. "ANIMATION") ends on the day BEFORE (Wednesday 18)—do not extend the previous bar past that. So "ANIMATION" run is Mon 16–Wed 18 only; "DELIVERY & TECH CHECK" run is Thu 19–Fri 20. For each merged run: first day = that label; continuation days = same activity + mergeWithPrevious: true. Do not mix different bars into one run.
Step D — Use the EXACT labels from the calendar. If the calendar says "ANIMATION" use label "ANIMATION"; if it says "ANIM R3 EOD" or "PICTURE LOCK EOD" use that exact text. Do not rename or substitute—the label must match what is written in the calendar so merged blocks are labeled correctly.

CRITICAL - EXACT DATE MATCHING (COLUMN = DATE):
- One column = one date. Only put an activity on a date if it appears in that date's column. If Monday has a block and Sunday does not, that block is Monday only—never put it on Sunday.
- Read day-of-month from the column header and day-of-week from the calendar layout. Build YYYY-MM-DD and only output that date if something actually appears in that column (or as a continuation of a bar that starts in a previous column).
- Empty column = no schedule entry for that date, or only continuations of bars that started earlier.

CRITICAL - MULTIPLE MERGED BLOCKS (each bar has its own start and end):
- A calendar can have several different spanning bars (e.g. "ANIMATION" Mon 16–Wed 18, "DELIVERY & TECH CHECK" Thu 19–Fri 20). Identify each spanning bar separately by its label and position/row.
- When a NEW bar with a different label starts on a day (e.g. "DELIVERY & TECH CHECK" on Thursday 19), the PREVIOUS bar (e.g. "ANIMATION") ends on the day BEFORE (Wednesday 18). Do NOT extend the previous bar to Thursday or Friday. Each merged block has a clear end date—do not output the previous block on the new block's start day or after.
- For each merged run: output that block only on days in its range. First day: label and activity; continuation days: same activity + mergeWithPrevious: true. Keep each run's label correct (e.g. "ANIMATION" not "Production" as the label).

CRITICAL - LABELS MUST MATCH THE CALENDAR:
- Use the exact wording from the calendar image for the "label" field (e.g. "ANIMATION", "ANIM R3 EOD", "PICTURE LOCK EOD", "9:30am - Ricardo"). Do not substitute generic names. Merged blocks must show the correct calendar label on the first day; continuation days use mergeWithPrevious: true (same activity, so the bar displays as one).

Example (days 16, 17, 18): One bar "ANIMATION" spans 16–18 (label only on 16). Day 16 column also has "ANIM R3 EOD", "HOLIDAY". Day 17 column has continuation of ANIMATION bar (no text), "ANIM R4 EOD", "9:30am - Ricardo". Day 18 column has continuation of ANIMATION bar, "PICTURE LOCK EOD".
Correct output (labels as in calendar; activity types from your list for color):
- Day 16: [ { "activity": "Production", "label": "ANIMATION" }, { "activity": "Creative Review", "label": "ANIM R3 EOD" }, { "activity": "Creative Review", "label": "HOLIDAY" } ]
- Day 17: [ { "activity": "Production", "mergeWithPrevious": true }, { "activity": "Creative Review", "label": "ANIM R4 EOD" }, { "activity": "Client Meeting", "label": "9:30am - Ricardo" } ]
- Day 18: [ { "activity": "Production", "mergeWithPrevious": true }, { "activity": "Post-Production", "label": "PICTURE LOCK EOD" } ]
(ANIMATION run uses same activity "Production" for all three days so it merges; labels are the exact calendar text.)
2. Detect the production type (radio, animation, live action, or general) from the user's prompt or from the PDF content
3. Use appropriate terminology and common milestones for that production type
4. If the user mentions a production type, research and include typical timeline milestones for that type (e.g., for animation: Design Lock, Animation Lock, Color Lock; for radio: Script Approval, Recording Session, Final Mix)
5. Parse the user's freeform text (and any PDF calendar text) about their production timeline
6. Extract dates, activities, and any specific labels or milestones using production-appropriate terminology
7. Assign a different activity type (and thus a different color) for each distinct label or phase—never use the same activity/color for two different labels (e.g. Creative Review and Production must not share the same color).
8. Infer dates from relative descriptions (e.g., "scripts lock Jan 15" means January 15, ${currentYear})
9. If year is not specified, assume ${currentYear}
10. Return ONLY a valid JSON object in this exact format (no markdown, no extra text):

{
  "schedule": [
    {
      "date": "YYYY-MM-DD",
      "stripes": [
        {
          "activity": "ActivityName",
          "label": "Optional custom label"
        }
      ]
    },
    {
      "date": "YYYY-MM-DD",
      "stripes": [
        {
          "activity": "ActivityName",
          "mergeWithPrevious": true
        }
      ]
    }
  ]
}

Rules:
- CRITICAL - LABEL = EXACT CALENDAR TEXT ONLY: The "label" field is what appears on each block. It must be the exact text from the calendar (e.g. "DESIGN", "ANIMATION", "AWARD", "DESIGN R1 EOD", "MOTION TESTS", "DESIGN R2 EOD", "DESIGN R3 EOD", "9:30am - Ricardo", "DESIGN LOCK EOD", "ANIM R1 EOD", "PICTURE LOCK EOD", "DELIVERY & TECH CHECK", "FINAL DELIVERY"). NEVER use activity type names (Production, Pre-Production, Audio Mix, Creative Review, Client Meeting, etc.) as the label unless that exact word appears on the calendar. "activity" is only for assigning a color—pick one from the list; the user sees "label".
- ONE COLUMN = ONE DATE: If Sunday's column is empty, do not put any activity on Sunday. If a block is in Monday's column, it is Monday only. Build each date from column header (day-of-month) and calendar layout (day-of-week).
- MULTIPLE MERGED BLOCKS: Track each spanning bar separately. Each bar has its own end date. When a NEW bar with a different label starts on a day (e.g. DELIVERY & TECH CHECK on Thu 19), the PREVIOUS bar (e.g. ANIMATION) ends the day before (Wed 18)—do not extend the previous bar to the new bar's days. So ANIMATION = Mon 16–Wed 18 only; DELIVERY & TECH CHECK = Thu 19–Fri 20. Each run: first day has the calendar label; continuation days have same activity + mergeWithPrevious: true. Do not mix different runs.
- UNLABELED BLOCK = MERGED: If a column has a block with no text but same bar continuing from previous column, output that same activity with mergeWithPrevious: true for that day.
- "activity" must be one of the available activity types listed above (match the name exactly). Use it for color; use "label" for the exact text from the calendar.
- "label" must match what is written in the calendar. For production milestones use appropriate terminology but keep the calendar's exact phrasing when it appears:
  * Radio: "Script Approval", "Voice Recording", "Rough Mix", "Final Mix", "Broadcast Ready", etc.
  * Animation: "Design Lock", "Storyboard Approval", "Animation Lock", "Color Lock", "Final Render", etc.
  * Live Action: "Script Lock", "Principal Photography", "Picture Lock", "VFX Lock", "Color Grade", "Final Mix", etc.
  * General: "Script Lock", "Client Approval", "Ship Date", "Delivery", etc.
- CRITICAL - Use different colors for different labels: each distinct phase, milestone, or label must use a DIFFERENT activity type (and thus a different color). For example, if you have "Creative Review" and "Production", use the Creative Review activity for one and the Production activity for the other—never use the same activity for two conceptually different labels. If you have multiple distinct phases (e.g. two different "Creative Review" blocks with different labels like "Draft" vs "Final", you may use the same activity only when the label is the same type; otherwise assign a different activity so each distinct label gets its own color.
- When the user specifies a production type, automatically include common timeline milestones for that type even if not explicitly mentioned (e.g., for animation: include Design Lock, Animation Lock phases; for radio: include Script Approval, Recording Session, Mix phases)
- "mergeWithPrevious": true means this stripe is part of the same continuous block as the previous stripe (same activity, consecutive dates)
- For merged continuation days, include the SAME "label" as the first day of the run (e.g. "label": "DESIGN" on every day in the DESIGN run) so the program shows the correct title on the merged block
- Do NOT include any date that has no events (e.g. if Sunday or Saturday is empty, do not output that date)
- Return dates in chronological order; only include dates that have at least one stripe
- Each date can have multiple stripes (different activities on the same day)
- If the user mentions a date range (e.g., "Production runs Jan 15-20"), create separate entries for each date with mergeWithPrevious: true

Return ONLY the JSON object, nothing else.`

    // Build user message: text only, or text + images (vision)
    const userContent = hasImages
      ? [
          { type: 'text' as const, text: finalPrompt },
          ...imageUrls.slice(0, 20).map((url: string) => ({
            type: 'image_url' as const,
            image_url: { url: url.startsWith('data:') ? url : `data:image/png;base64,${url}` },
          })),
        ]
      : finalPrompt

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenAI API error:', response.status, errorData)
      return NextResponse.json(
        { error: 'Failed to generate schedule', details: `OpenAI API error: ${response.status}` },
        { status: 500 }
      )
    }

    const data = await response.json()
    const aiResponse = data.choices?.[0]?.message?.content

    if (!aiResponse) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      )
    }

    // Parse the JSON response
    let parsedResponse
    try {
      parsedResponse = JSON.parse(aiResponse)
    } catch (parseError: any) {
      console.error('Failed to parse AI response as JSON:', aiResponse)
      return NextResponse.json(
        { error: 'AI response was not valid JSON', details: parseError.message },
        { status: 400 }
      )
    }

    // Validate the structure
    if (!parsedResponse.schedule || !Array.isArray(parsedResponse.schedule)) {
      return NextResponse.json(
        { error: 'Invalid schedule format from AI' },
        { status: 400 }
      )
    }

    return NextResponse.json(parsedResponse)
  } catch (error: any) {
    console.error('Error generating AI schedule:', error)
    return NextResponse.json(
      { error: 'Failed to generate schedule', details: error.message },
      { status: 500 }
    )
  }
}

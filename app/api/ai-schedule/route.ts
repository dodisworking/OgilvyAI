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

    const { prompt, currentMonth, brushes } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

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
1. Detect the production type (radio, animation, live action, or general) from the user's prompt
2. Use appropriate terminology and common milestones for that production type
3. If the user mentions a production type, research and include typical timeline milestones for that type (e.g., for animation: Design Lock, Animation Lock, Color Lock; for radio: Script Approval, Recording Session, Final Mix)
4. Parse the user's freeform text about their production timeline
5. Extract dates, activities, and any specific labels or milestones using production-appropriate terminology
6. Assign a different activity type (and thus a different color) for each distinct label or phase—never use the same activity/color for two different labels (e.g. Creative Review and Production must not share the same color).
7. Infer dates from relative descriptions (e.g., "scripts lock Jan 15" means January 15, ${currentYear})
8. If year is not specified, assume ${currentYear}
9. Return ONLY a valid JSON object in this exact format (no markdown, no extra text):

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
- "activity" must be one of the available activity types listed above (match the name exactly)
- "label" is REQUIRED for production-specific milestones - use appropriate terminology:
  * Radio: "Script Approval", "Voice Recording", "Rough Mix", "Final Mix", "Broadcast Ready", etc.
  * Animation: "Design Lock", "Storyboard Approval", "Animation Lock", "Color Lock", "Final Render", etc.
  * Live Action: "Script Lock", "Principal Photography", "Picture Lock", "VFX Lock", "Color Grade", "Final Mix", etc.
  * General: "Script Lock", "Client Approval", "Ship Date", "Delivery", etc.
- CRITICAL - Use different colors for different labels: each distinct phase, milestone, or label must use a DIFFERENT activity type (and thus a different color). For example, if you have "Creative Review" and "Production", use the Creative Review activity for one and the Production activity for the other—never use the same activity for two conceptually different labels. If you have multiple distinct phases (e.g. two different "Creative Review" blocks with different labels like "Draft" vs "Final", you may use the same activity only when the label is the same type; otherwise assign a different activity so each distinct label gets its own color.
- When the user specifies a production type, automatically include common timeline milestones for that type even if not explicitly mentioned (e.g., for animation: include Design Lock, Animation Lock phases; for radio: include Script Approval, Recording Session, Mix phases)
- "mergeWithPrevious": true means this stripe is part of the same continuous block as the previous stripe (same activity, consecutive dates)
- Only include "mergeWithPrevious" if the previous date has the same activity and they should be visually connected
- Return dates in chronological order
- Each date can have multiple stripes (different activities on the same day)
- If the user mentions a date range (e.g., "Production runs Jan 15-20"), create separate entries for each date with mergeWithPrevious: true

Return ONLY the JSON object, nothing else.`

    // Call OpenAI API
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
          { role: 'user', content: prompt.trim() },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Lower temperature for more consistent, structured output
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

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/session'

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

export interface AiScheduleStripe {
  activity: string
  label?: string
  mergeWithPrevious?: boolean
}

export interface AiScheduleDay {
  date: string // YYYY-MM-DD
  stripes: AiScheduleStripe[]
}

/** Step "recognize": AI returns simple day-by-day list. NO JSON. */
const RECOGNIZE_SYSTEM_PROMPT = `You are reading a production calendar. List each day and what's on it.

FORMAT - List each day like this:

Monday February 2
- DESIGN (merged)
- AWARD

Tuesday February 3
- DESIGN (merged)
- DESIGN R1 EOD

Wednesday February 4
- DESIGN (merged)
- MOTION TESTS (merged)
- DESIGN R2 EOD

Thursday February 5
- DESIGN (merged)
- MOTION TESTS (merged)
- DESIGN R3 EOD
- 9:30am Ricardo

Friday February 6
- DESIGN (merged)
- MOTION TESTS (merged)
- DESIGN LOCK EOD

Saturday February 7
- empty

Sunday February 8
- empty

Monday February 9
- ANIMATION (merged)
- 10am KO ANIM

...continue for all days...

RULES:
1. List EVERY day of the month
2. If a colored bar spans multiple days, write "(merged)" after it
3. If a day has multiple items stacked, list each one
4. Sundays are almost always "empty" - bars start on Monday, not Sunday
5. If a day has nothing, write "- empty"

That's it. Just list each day and what's on it. Plain text only.`

/** Step "populate" or default: AI converts text summary into JSON schedule. */
const SYSTEM_PROMPT = `You are a production schedule assistant. Convert day-by-day text to JSON.

INPUT FORMAT:
Monday February 2
- DESIGN (merged)
- AWARD

Tuesday February 3
- DESIGN (merged)
- DESIGN R1 EOD

Wednesday February 4
- DESIGN (merged)
- MOTION TESTS (merged)

Thursday February 5
- empty

RULES:
- Items marked "(merged)" that appear on consecutive days should have mergeWithPrevious: true (except the first day)
- Items without "(merged)" are single-day blocks
- "empty" = stripes: []

OUTPUT FORMAT - JSON array:
[
{"date":"2026-02-02","stripes":[{"activity":"DESIGN"},{"activity":"AWARD"}]},
{"date":"2026-02-03","stripes":[{"activity":"DESIGN","mergeWithPrevious":true},{"activity":"DESIGN R1 EOD"}]},
{"date":"2026-02-04","stripes":[{"activity":"DESIGN","mergeWithPrevious":true},{"activity":"MOTION TESTS"}]},
{"date":"2026-02-05","stripes":[]}
]

Output ONLY the JSON array. No other text.`

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get('cookie')
    const session = await getSessionFromCookie(cookieHeader)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to your .env file.' },
        { status: 500 }
      )
    }

    let body: { prompt?: string; currentMonth?: string; brushes?: unknown; images?: string[]; step?: string; summary?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const step = body.step === 'recognize' ? 'recognize' : body.step === 'populate' ? 'populate' : undefined
    const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const images: string[] = Array.isArray(body.images) ? body.images : []
    const currentMonth = typeof body.currentMonth === 'string' ? body.currentMonth : ''

    // --- STEP: RECOGNIZE (images → plain text day-by-day summary) ---
    if (step === 'recognize') {
      if (images.length === 0) {
        return NextResponse.json(
          { error: 'Recognition step requires uploaded calendar images.' },
          { status: 400 }
        )
      }
      const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = []
      let recognizePrompt = 'List each day of the month and what\'s on it. Format:\n\nMonday February 2\n- DESIGN (merged)\n- AWARD\n\nTuesday February 3\n- DESIGN (merged)\n\n...etc for all days.\n\nWrite "(merged)" if a bar spans multiple days. Sundays are usually empty. Plain text only.'
      if (currentMonth) {
        try {
          const monthDate = new Date(currentMonth)
          const monthYear = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
          recognizePrompt = `The calendar is for ${monthYear} (${daysInMonth} days). ${recognizePrompt}`
        } catch {
          // keep default
        }
      }
      // Do NOT append user prompt here – we only want simple writing, never "return JSON"
      recognizePrompt += '\n\nList ALL days. If multiple items on same day, list each. Sundays usually empty. Plain text only.'
      content.push({ type: 'text', text: recognizePrompt })
      for (const dataUrl of images) {
        if (typeof dataUrl === 'string' && (dataUrl.startsWith('data:') || dataUrl.startsWith('http'))) {
          content.push({ type: 'image_url', image_url: { url: dataUrl } })
        }
      }

      const resRecognize = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: RECOGNIZE_SYSTEM_PROMPT },
            { role: 'user', content: content },
          ],
          max_tokens: 4096,
        }),
      })
      if (!resRecognize.ok) {
        const err = await resRecognize.json().catch(() => ({}))
        const message = (err as { error?: { message?: string } })?.error?.message || resRecognize.statusText
        return NextResponse.json({ error: `OpenAI API error: ${message}` }, { status: 502 })
      }
      const dataRecognize = (await resRecognize.json()) as { choices?: Array<{ message?: { content?: string } }> }
      let summaryText = dataRecognize.choices?.[0]?.message?.content?.trim() || ''
      
      // If the model returned JSON by mistake, try to convert it to text format
      const looksLikeJson = /^\s*[\{\[]/.test(summaryText) ||
        summaryText.includes('```json') ||
        (summaryText.includes('"date":') && summaryText.includes('"stripes":'))
      if (looksLikeJson) {
        try {
          // Try to parse and convert JSON to text format
          const cleanJson = summaryText.replace(/^```json\s*|\s*```$/g, '').trim()
          const parsed = JSON.parse(cleanJson)
          if (Array.isArray(parsed)) {
            // Convert JSON schedule to day-by-day text format with merge codes
            let monthName = 'February'
            let monthShort = 'Feb'
            let year = '2026'
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            
            // First pass: identify merged blocks and assign codes
            const mergeCodeMap: Record<string, string> = {} // activity -> code
            let codeCounter = 0
            const codeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            parsed.forEach((day: { date?: string; stripes?: Array<{ activity?: string; label?: string; mergeWithPrevious?: boolean }> }) => {
              if (!day.stripes) return
              day.stripes.forEach((stripe) => {
                const name = stripe.label || stripe.activity || 'Unknown'
                if (stripe.mergeWithPrevious && !mergeCodeMap[name]) {
                  // Find the original (first occurrence) of this merged block
                }
                if (!stripe.mergeWithPrevious) {
                  // Check if this block continues (has mergeWithPrevious later)
                  // We'll handle this in second pass
                }
              })
            })
            
            // Second pass: find which blocks are merged (appear with mergeWithPrevious)
            const mergedActivities = new Set<string>()
            parsed.forEach((day: { date?: string; stripes?: Array<{ activity?: string; label?: string; mergeWithPrevious?: boolean }> }) => {
              if (!day.stripes) return
              day.stripes.forEach((stripe) => {
                if (stripe.mergeWithPrevious) {
                  mergedActivities.add(stripe.label || stripe.activity || '')
                }
              })
            })
            
            // Assign codes to merged activities
            mergedActivities.forEach((activity) => {
              const letter = codeLetters[codeCounter % 26]
              const num = Math.floor(codeCounter / 26) + 1
              mergeCodeMap[activity] = `${letter}${num}`
              codeCounter++
            })
            
            // Build day-by-day output
            const lines: string[] = []
            parsed.forEach((day: { date?: string; stripes?: Array<{ activity?: string; label?: string; mergeWithPrevious?: boolean }> }, idx: number) => {
              if (!day.date) return
              const dateParts = day.date.split('-')
              if (dateParts.length === 3 && idx === 0) {
                year = dateParts[0]
                const monthNum = parseInt(dateParts[1], 10)
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
                const monthShorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                monthName = monthNames[monthNum - 1] || 'February'
                monthShort = monthShorts[monthNum - 1] || 'Feb'
                lines.push(`${monthName} ${year}`, '')
              }
              
              const dayNum = parseInt(dateParts[2], 10)
              const dateObj = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, dayNum)
              const dayOfWeek = dayNames[dateObj.getDay()]
              const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' : dayNum === 2 || dayNum === 22 ? 'nd' : dayNum === 3 || dayNum === 23 ? 'rd' : 'th'
              
              if (!day.stripes || day.stripes.length === 0) {
                lines.push(`${dayOfWeek} ${monthShort} ${dayNum}${suffix} - empty`)
              } else {
                const blockList = day.stripes.map((stripe) => {
                  const name = stripe.label || stripe.activity || 'Unknown'
                  const code = mergeCodeMap[name]
                  return code ? `${name} (${code})` : name
                }).join(', ')
                lines.push(`${dayOfWeek} ${monthShort} ${dayNum}${suffix} - ${blockList}`)
              }
            })
            summaryText = lines.join('\n')
          }
        } catch {
          // If conversion fails, return error
          return NextResponse.json(
            { error: 'The AI returned JSON instead of simple writing. Please try "Import & generate schedule" again.' },
            { status: 502 }
          )
        }
      }
      return NextResponse.json({
        summary: summaryText,
        sentToOpenAI: { prompt: recognizePrompt, imageCount: images.length },
      })
    }

    // --- STEP: POPULATE (text summary → JSON schedule) ---
    if (step === 'populate') {
      if (!summary) {
        return NextResponse.json(
          { error: 'Populate step requires a schedule summary (from the recognition step).' },
          { status: 400 }
        )
      }
      const populatePrompt = `Convert this day-by-day list into a JSON array.

INPUT FORMAT: Each line is a day with its blocks. Codes like (A1), (B1) indicate merged blocks.
- Same code on multiple days = merged block (use mergeWithPrevious:true on days after the first)
- No code = single day block (no mergeWithPrevious)
- "empty" = no blocks (stripes: [])

OUTPUT: JSON array with one object per day. Strip the codes from activity names.

Day-by-day list:
${summary}`

      const resPopulate = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: populatePrompt + '\n\nRespond with ONLY the JSON array. No other text.' },
          ],
          max_tokens: 4096,
        }),
      })
      if (!resPopulate.ok) {
        const err = await resPopulate.json().catch(() => ({}))
        const message = (err as { error?: { message?: string } })?.error?.message || resPopulate.statusText
        return NextResponse.json({ error: `OpenAI API error: ${message}` }, { status: 502 })
      }
      const dataPopulate = (await resPopulate.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const rawContent = dataPopulate.choices?.[0]?.message?.content?.trim() || '[]'
      let schedule: AiScheduleDay[]
      try {
        const parsed = JSON.parse(rawContent.replace(/^```json\s*|\s*```$/g, '').trim())
        schedule = Array.isArray(parsed) ? parsed : []
      } catch {
        return NextResponse.json(
          { error: 'AI response was not valid JSON. Please try again.' },
          { status: 502 }
        )
      }
      return NextResponse.json({ schedule, rawResponse: rawContent })
    }

    // --- DEFAULT: text-only → JSON schedule ---
    if (!prompt && images.length === 0) {
      return NextResponse.json(
        { error: 'Please provide a prompt and/or upload calendar images' },
        { status: 400 }
      )
    }

    // Get month info for context
    let monthYear = 'February 2026'
    let daysInMonth = 28
    if (currentMonth) {
      try {
        const monthDate = new Date(currentMonth)
        monthYear = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
      } catch {
        // keep defaults
      }
    }

    const textOnlySystemPrompt = `You are a production schedule assistant. Convert the user's schedule description into a JSON array.

The calendar is for ${monthYear} (${daysInMonth} days).

OUTPUT FORMAT - JSON array with one object per day that has content:
[
{"date":"2026-02-02","stripes":[{"activity":"DESIGN"},{"activity":"AWARD"}]},
{"date":"2026-02-03","stripes":[{"activity":"DESIGN","mergeWithPrevious":true},{"activity":"DESIGN R1 EOD"}]},
{"date":"2026-02-04","stripes":[{"activity":"DESIGN","mergeWithPrevious":true},{"activity":"MOTION TESTS"}]}
]

RULES:
- If user says something spans multiple days (e.g., "DESIGN from Monday to Friday"), set mergeWithPrevious: true for all days after the first
- Parse dates relative to ${monthYear}
- Only include days that have content
- Output ONLY the JSON array, no other text`

    const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = []
    content.push({
      type: 'text',
      text: prompt,
    })

    for (const dataUrl of images) {
      if (typeof dataUrl === 'string' && (dataUrl.startsWith('data:') || dataUrl.startsWith('http'))) {
        content.push({
          type: 'image_url',
          image_url: { url: dataUrl },
        })
      }
    }

    const model = 'gpt-4o-mini' // Text-only uses faster model

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: textOnlySystemPrompt },
          { role: 'user', content: prompt + '\n\nRespond with ONLY a JSON array. No other text.' },
        ],
        max_tokens: 4096,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const message = (err as { error?: { message?: string } })?.error?.message || res.statusText
      return NextResponse.json(
        { error: `OpenAI API error: ${message}` },
        { status: 502 }
      )
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const rawContent = data.choices?.[0]?.message?.content?.trim() || '[]'

    let schedule: AiScheduleDay[]
    try {
      const parsed = JSON.parse(rawContent.replace(/^```json\s*|\s*```$/g, '').trim())
      schedule = Array.isArray(parsed) ? parsed : []
    } catch {
      return NextResponse.json(
        { error: 'AI response was not valid JSON. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ schedule, rawResponse: rawContent })
  } catch (error: unknown) {
    console.error('AI schedule error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate schedule' },
      { status: 500 }
    )
  }
}

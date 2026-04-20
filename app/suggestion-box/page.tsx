'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/UI/Button'

type SuggestionType = 'SUGGESTION' | 'BUG' | 'IDEA'

interface Suggestion {
  id: string
  type: SuggestionType
  content: string
  submitterName?: string | null
  submitterEmail?: string | null
  createdAt: string
}

export default function SuggestionBoxPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [type, setType] = useState<SuggestionType>('SUGGESTION')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (!response.ok) {
          router.push('/')
          return
        }
        await fetchSuggestions()
      } catch {
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuthAndLoad()
  }, [router])

  const fetchSuggestions = async () => {
    try {
      const response = await fetch('/api/suggestions', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!content.trim()) {
      setError('Please write your suggestion')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          content: content.trim(),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit suggestion')
      }

      setContent('')
      setSuccess('Thanks! Your suggestion has been submitted.')
      await fetchSuggestions()
    } catch (err: any) {
      setError(err.message || 'Failed to submit suggestion')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-600 dark:text-gray-300">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            📥 Suggestion Box
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Share ideas, report bugs, or suggest improvements.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Submit a Suggestion
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['SUGGESTION', 'BUG', 'IDEA'] as SuggestionType[]).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      className={`px-4 py-2 rounded-lg border-2 font-medium transition-all text-sm ${
                        type === option
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {option === 'SUGGESTION' ? '💡 Suggestion' : option === 'BUG' ? '🐞 Bug' : '✨ Idea'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                  Message
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Tell us what you want to see..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <Button type="submit" isLoading={isSubmitting} className="w-full">
                Submit
              </Button>
            </form>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                Recent Suggestions
              </h2>
              <button
                onClick={fetchSuggestions}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-4 max-h-[520px] overflow-y-auto">
              {suggestions.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No suggestions yet.</p>
              )}
              {suggestions.map((s) => (
                <div key={s.id} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                      {s.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {s.content}
                  </p>
                  {(s.submitterName || s.submitterEmail) && (
                    <p className="text-xs text-gray-500 mt-2">
                      {s.submitterName || 'Anonymous'} {s.submitterEmail ? `(${s.submitterEmail})` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

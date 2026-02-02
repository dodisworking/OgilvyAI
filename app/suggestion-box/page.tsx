'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Button from '@/components/UI/Button'

export default function SuggestionBoxPage() {
  const [type, setType] = useState<string>('SUGGESTION')
  const [content, setContent] = useState('')
  const [submitterName, setSubmitterName] = useState('')
  const [submitterEmail, setSubmitterEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((r) => r.ok)
      .then(setIsLoggedIn)
      .catch(() => setIsLoggedIn(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmed = content.trim()
    if (!trimmed) {
      setError('Please write your suggestion, bug report, or idea.')
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          content: trimmed,
          ...(isLoggedIn ? {} : { submitterName: submitterName.trim() || undefined, submitterEmail: submitterEmail.trim() || undefined }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
      setContent('')
      setSubmitterName('')
      setSubmitterEmail('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4 text-3xl">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            Thanks!
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            We got your submission and will take a look.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => setSubmitted(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Submit another
            </Button>
            <Link href={isLoggedIn ? '/dashboard' : '/'} className="w-full sm:w-auto">
              <Button variant="primary" className="w-full">
                {isLoggedIn ? 'Back to Dashboard' : 'Back to Home'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Suggestion Box
          </h1>
          {isLoggedIn && (
            <Link
              href="/dashboard"
              className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
            >
              ← Dashboard
            </Link>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Share a suggestion, report a bug or error in an app, or request an idea you’d like built.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              This is a…
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="SUGGESTION">Suggestion</option>
              <option value="BUG">Bug or error</option>
              <option value="IDEA">Feature idea / request</option>
            </select>
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              placeholder="Describe your suggestion, the bug you saw, or the idea you’d like..."
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-y min-h-[120px]"
            />
          </div>

          {!isLoggedIn && (
            <>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your email <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-purple-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full">
            Submit
          </Button>
        </form>

        {!isLoggedIn && (
          <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link href="/" className="text-purple-600 hover:underline">
              Sign in
            </Link>
            {' '}to have your name and email attached automatically.
          </p>
        )}
      </div>
    </div>
  )
}

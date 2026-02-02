'use client'

import Link from 'next/link'

export default function TalentTrackerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-purple-200 dark:border-purple-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            ✨
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent text-center mb-2">
            Talent Tracker
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            Coming soon — track and manage talent in one place.
          </p>
        </div>
      </div>
    </div>
  )
}

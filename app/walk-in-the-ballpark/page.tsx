'use client'

import Link from 'next/link'

export default function WalkInTheBallparkPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-gray-900 dark:via-amber-900 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-amber-600 hover:text-amber-700 dark:text-amber-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-amber-200 dark:border-amber-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            ⚾
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent text-center mb-2">
            Walk In the Ballpark
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
            AI-powered estimates, fast
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-center text-sm">
            Get estimates done quickly with your AI assistant. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

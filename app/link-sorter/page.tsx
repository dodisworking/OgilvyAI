'use client'

import Link from 'next/link'

export default function LinkSorterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-gray-900 dark:via-rose-900 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-rose-600 hover:text-rose-700 dark:text-rose-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-rose-200 dark:border-rose-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            🔗
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent text-center mb-2">
            Link Sorter
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
            Production links, sorted with AI
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-center text-sm">
            Organize and call on production links quickly. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

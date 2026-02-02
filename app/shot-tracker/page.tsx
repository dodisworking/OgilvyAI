'use client'

import Link from 'next/link'

export default function ShotTrackerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-indigo-200 dark:border-indigo-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-500 to-slate-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            ✅
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-slate-600 bg-clip-text text-transparent text-center mb-2">
            I Play Chess, You Play Check Off
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
            Live shot list tracker for production
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-center text-sm">
            Track the shot list in real time. Everyone on the app sees progress during production. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

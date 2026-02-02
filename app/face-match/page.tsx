'use client'

import Link from 'next/link'

export default function FaceMatchPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-cyan-900 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-cyan-200 dark:border-cyan-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            👤
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent text-center mb-2">
            Face Match
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
            AI Talent Recognition
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-center text-sm">
            Match talent to talent reports using facial recognition. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

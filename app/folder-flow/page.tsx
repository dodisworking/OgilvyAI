'use client'

import Link from 'next/link'

export default function FolderFlowPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-emerald-900 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-sm font-medium mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-emerald-200 dark:border-emerald-800">
          <div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center text-3xl mb-6 mx-auto">
            📁
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent text-center mb-2">
            Folder Flow
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center text-sm mb-2">
            AI Folder Organizer Assistant
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-center text-sm">
            Organize your folders with AI. Coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}

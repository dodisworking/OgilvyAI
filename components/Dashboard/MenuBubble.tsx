'use client'

import React from 'react'

interface MenuBubbleProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
  gradient: string
  inDevelopment?: boolean
}

export default function MenuBubble({ title, description, icon, onClick, gradient, inDevelopment }: MenuBubbleProps) {
  return (
    <button
      onClick={onClick}
      className={`relative group bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden h-full min-h-[200px] flex flex-col text-left w-full ${
        inDevelopment ? 'opacity-[0.64] hover:opacity-90' : ''
      }`}
    >
      {/* In development badge */}
      {inDevelopment && (
        <div className="absolute top-3 right-3 z-20">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            In development
          </span>
        </div>
      )}
      {/* Gradient background */}
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
      
      <div className="relative z-10 flex-1 flex flex-col">
        <div className="text-4xl mb-4 transform group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
          {icon}
        </div>
        <h3 className="text-xl font-bold mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300 line-clamp-2">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 flex-1">
          {description}
        </p>
      </div>
    </button>
  )
}
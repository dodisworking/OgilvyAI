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
      className={`relative group bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden h-full min-h-[180px] flex flex-col text-left w-full ${inDevelopment ? 'opacity-[0.64]' : ''}`}
    >
      {/* In Development badge - top right */}
      {inDevelopment && (
        <div className="absolute top-2 right-2 z-20 rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-2 py-0.5">
          <span className="text-[10px] font-medium text-amber-800 dark:text-amber-200 whitespace-nowrap">In development</span>
        </div>
      )}

      {/* Gradient background */}
      <div className={`absolute inset-0 ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
      
      <div className="relative z-10 flex flex-col flex-1">
        <div className="flex-shrink-0 w-12 h-12 mb-3 transform group-hover:scale-110 transition-transform duration-300 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-base font-bold mb-1.5 line-clamp-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-600 group-hover:to-pink-600 transition-all duration-300 leading-tight">
          {title}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-xs line-clamp-2 leading-snug flex-1">
          {description}
        </p>
      </div>
    </button>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoginForm from '@/components/Auth/LoginForm'
import RegisterForm from '@/components/Auth/RegisterForm'
import Button from '@/components/UI/Button'

export default function Home() {
  const [isLogin, setIsLogin] = useState(true)
  const [isLoadingTim, setIsLoadingTim] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in by calling /api/auth/me
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.isAdmin) {
            router.push('/admin')
          } else {
            router.push('/dashboard')
          }
        }
      } catch (error) {
        // Not authenticated, stay on login page
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
          {/* Decorative background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Production Department
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </p>

            {isLogin ? <LoginForm /> : <RegisterForm />}

            <div className="mt-6 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-purple-600 hover:text-purple-700 font-medium"
              >
                {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={async () => {
                  setIsLoadingTim(true)
                  try {
                    // Directly log in as admin without credentials
                    const response = await fetch('/api/admin/login', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      credentials: 'include',
                      body: JSON.stringify({
                        autoLogin: true, // Flag to skip password check
                      }),
                    })

                    if (response.ok) {
                      // Small delay to show loading animation
                      await new Promise(resolve => setTimeout(resolve, 500))
                      router.push('/admin')
                      router.refresh()
                    } else {
                      const data = await response.json()
                      console.error('Admin login error:', data.error || 'Failed to log in')
                      // Don't show alert - just redirect anyway
                      await new Promise(resolve => setTimeout(resolve, 500))
                      router.push('/admin')
                      router.refresh()
                    }
                  } catch (error) {
                    console.error('Admin login error:', error)
                    // Don't show alert - just redirect anyway
                    await new Promise(resolve => setTimeout(resolve, 500))
                    router.push('/admin')
                    router.refresh()
                  } finally {
                    setIsLoadingTim(false)
                  }
                }}
                disabled={isLoadingTim}
                className="w-full text-sm"
              >
                {isLoadingTim ? 'Loading Tim...' : 'Are you Tim?'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Tim Overlay */}
      {isLoadingTim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mb-4"></div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Loading Tim...</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                Please wait while we log you in as Tim
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
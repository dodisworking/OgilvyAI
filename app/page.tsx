'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoginForm from '@/components/Auth/LoginForm'
import RegisterForm from '@/components/Auth/RegisterForm'
import Button from '@/components/UI/Button'

export default function Home() {
  const [isLogin, setIsLogin] = useState(true)
  const [showTimLogin, setShowTimLogin] = useState(false)
  const [timPassword, setTimPassword] = useState('')
  const [timError, setTimError] = useState('')
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

  const handleTimLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setTimError('')
    setIsLoadingTim(true)

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          password: timPassword,
        }),
      })

      if (response.ok) {
        router.push('/admin')
        router.refresh()
      } else {
        const data = await response.json()
        setTimError(data.error || 'Invalid password')
      }
    } catch (error) {
      console.error('Admin login error:', error)
      setTimError('Failed to login. Please try again.')
    } finally {
      setIsLoadingTim(false)
    }
  }

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
                onClick={() => setShowTimLogin(true)}
                className="w-full text-sm"
              >
                Are you Tim?
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tim Login Modal */}
      {showTimLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in duration-300">
            <button
              onClick={() => {
                setShowTimLogin(false)
                setTimPassword('')
                setTimError('')
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>

            <div className="text-center mb-6">
              <div className="text-5xl mb-4">👑</div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                Tim Login
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">
                Enter your password to access admin
              </p>
            </div>

            <form onSubmit={handleTimLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={timPassword}
                  onChange={(e) => setTimPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full px-4 py-3 rounded-lg border-2 border-yellow-200 focus:border-yellow-500 focus:outline-none transition-colors dark:bg-gray-700 dark:border-gray-600"
                  autoFocus
                />
              </div>

              {timError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {timError}
                </div>
              )}

              <Button
                type="submit"
                isLoading={isLoadingTim}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                👑 Login as Tim
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

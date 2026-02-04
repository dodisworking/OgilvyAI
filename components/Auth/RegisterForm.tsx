'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Button from '../UI/Button'

export default function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<'producer' | 'creative' | 'account' | ''>('')
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        setError('Please upload an image file (JPEG, PNG, GIF, or WebP)')
        return
      }

      // Validate file size (max 2MB to match API limit)
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB')
        return
      }

      setProfilePicture(file)
      setError('')

      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!role) {
      setError('Please select your role')
      return
    }

    if (!profilePicture) {
      setError('Please upload a profile picture')
      return
    }

    setIsLoading(true)

    try {
      // First upload the profile picture
      const formData = new FormData()
      formData.append('file', profilePicture)

      const uploadResponse = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        setError(uploadError.error || 'Failed to upload profile picture')
        setIsLoading(false)
        return
      }

      const uploadData = await uploadResponse.json()
      const profilePictureUrl = uploadData.url

      // Then register the user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          password,
          role,
          profilePicture: profilePictureUrl
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to register')
        setIsLoading(false)
        return
      }

      // Registration successful - redirect to login
      window.location.href = '/'
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Full Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="block text-sm font-medium mb-2">
          Work Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="you@company.com"
        />
      </div>

      {/* Role Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          What&apos;s your role? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRole('producer')}
            className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
              role === 'producer'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'border-gray-200 hover:border-purple-300 text-gray-600 dark:text-gray-400'
            }`}
          >
            🎬 Producer
          </button>
          <button
            type="button"
            onClick={() => setRole('creative')}
            className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
              role === 'creative'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'border-gray-200 hover:border-purple-300 text-gray-600 dark:text-gray-400'
            }`}
          >
            🎨 Creative
          </button>
          <button
            type="button"
            onClick={() => setRole('account')}
            className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
              role === 'account'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'border-gray-200 hover:border-purple-300 text-gray-600 dark:text-gray-400'
            }`}
          >
            📊 Account
          </button>
        </div>
      </div>

      {/* Profile Picture Upload */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Profile Picture <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            {profilePicturePreview ? (
              <img
                src={profilePicturePreview}
                alt="Profile preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-purple-300"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                <span className="text-gray-400 text-2xl">👤</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              id="profilePicture"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-600 hover:text-purple-700 text-sm font-medium transition-all"
            >
              {profilePicture ? 'Change Photo' : 'Upload Photo'}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              JPEG, PNG, GIF, or WebP (max 2MB)
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="register-password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="Create a password (min 6 characters)"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="Confirm your password"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        Create Account
      </Button>
    </form>
  )
}

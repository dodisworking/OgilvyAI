'use client'

import { useState, useRef } from 'react'
import Button from '../UI/Button'

interface ProfileSetupPromptProps {
  userName: string
  onComplete: (data: { profilePicture: string; accountType: string }) => void
  onSkip: () => void
}

export default function ProfileSetupPrompt({ userName, onComplete, onSkip }: ProfileSetupPromptProps) {
  const [role, setRole] = useState<'producer' | 'creative' | 'account' | ''>('')
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!validTypes.includes(file.type)) {
        setError('Please upload an image file (JPEG, PNG, GIF, or WebP)')
        return
      }

      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB')
        return
      }

      setProfilePicture(file)
      setError('')

      const reader = new FileReader()
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async () => {
    if (!profilePicture) {
      setError('Please upload a profile picture')
      return
    }

    if (!role) {
      setError('Please select your role')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Upload profile picture
      const formData = new FormData()
      formData.append('file', profilePicture)

      const uploadResponse = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        const uploadError = await uploadResponse.json()
        throw new Error(uploadError.error || 'Failed to upload profile picture')
      }

      const { url } = await uploadResponse.json()

      // Update profile with picture and role
      const updateResponse = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          profilePicture: url,
          accountType: role 
        }),
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update profile')
      }

      onComplete({ profilePicture: url, accountType: role })
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in duration-300">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">😅</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Oops! Quick Fix Needed
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Hey {userName}! Sorry, Isaac did an oopsie and we lost some profile data. 
            Could you help us out by re-uploading your photo and selecting your role?
          </p>
        </div>

        {/* Profile Picture Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Profile Picture
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {profilePicturePreview ? (
                <img
                  src={profilePicturePreview}
                  alt="Profile preview"
                  className="w-20 h-20 rounded-full object-cover border-4 border-purple-300"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-4 border-dashed border-gray-300 dark:border-gray-600">
                  <span className="text-gray-400 text-3xl">📷</span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-lg border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-600 hover:text-purple-700 text-sm font-medium transition-all w-full"
              >
                {profilePicture ? '✓ Change Photo' : 'Upload Photo'}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                Max 2MB
              </p>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What&apos;s your role?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRole('producer')}
              className={`px-3 py-3 rounded-lg border-2 font-medium transition-all text-sm ${
                role === 'producer'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              🎬 Producer
            </button>
            <button
              type="button"
              onClick={() => setRole('creative')}
              className={`px-3 py-3 rounded-lg border-2 font-medium transition-all text-sm ${
                role === 'creative'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              🎨 Creative
            </button>
            <button
              type="button"
              onClick={() => setRole('account')}
              className={`px-3 py-3 rounded-lg border-2 font-medium transition-all text-sm ${
                role === 'account'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 text-gray-600 dark:text-gray-400'
              }`}
            >
              📊 Account
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmit}
            isLoading={isLoading}
            className="w-full"
          >
            Save & Continue
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Skip for now (I&apos;ll do it later)
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Button from '../UI/Button'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null)
  const [needsProfilePicture, setNeedsProfilePicture] = useState(false)
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

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB')
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

    // If we already know they need a profile picture, handle the upload
    if (needsProfilePicture) {
      if (!profilePicture) {
        setError('Please upload a profile picture to continue')
        return
      }

      setIsLoading(true)

      try {
        // Upload the profile picture
        const formData = new FormData()
        formData.append('file', profilePicture)

        const uploadResponse = await fetch('/api/upload/profile', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          setError(uploadData.error || 'Failed to upload profile picture')
          setIsLoading(false)
          return
        }

        const uploadData = await uploadResponse.json()
        
        // Update user profile picture
        const updateResponse = await fetch('/api/auth/update-profile-picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ profilePicture: uploadData.url }),
        })

        if (!updateResponse.ok) {
          setError('Failed to update profile picture')
          setIsLoading(false)
          return
        }

        // Cookie is already set from initial login, redirect
        window.location.href = '/dashboard'
      } catch (err) {
        setError('An error occurred. Please try again.')
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Otherwise, try to login first
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to login')
        setIsLoading(false)
        return
      }

      // Check if user needs a profile picture
      if (data.needsProfilePicture) {
        setNeedsProfilePicture(true)
        setIsLoading(false)
        return
      }

      // #region agent log
      fetch('http://127.0.0.1:7247/ingest/296b3045-74d1-4efe-a041-a61e579682c1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/Auth/LoginForm.tsx:127',message:'Login successful - redirecting to dashboard',data:{userId:data.user?.id,email:data.user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Cookie is set by server, redirect immediately
      // The cookie will be available on the next page load
      window.location.href = '/dashboard'
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Work Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={needsProfilePicture}
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={needsProfilePicture}
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Enter your password"
        />
      </div>

      {/* Profile Picture Upload - shown if user needs one */}
      {needsProfilePicture && (
        <div>
          <label htmlFor="profilePicture" className="block text-sm font-medium mb-2">
            Profile Picture <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {profilePicturePreview ? (
                <img
                  src={profilePicturePreview}
                  alt="Profile preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-purple-300"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <span className="text-gray-400 text-xs">No image</span>
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
                required={needsProfilePicture}
                className="w-full px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                JPEG, PNG, GIF, or WebP (max 5MB)
              </p>
            </div>
          </div>
          <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
            Please upload a profile picture to continue
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        {needsProfilePicture ? 'Complete Profile' : 'Sign In'}
      </Button>
    </form>
  )
}
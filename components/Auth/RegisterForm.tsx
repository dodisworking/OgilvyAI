'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Button from '../UI/Button'

export default function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [accountType, setAccountType] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!profilePicture) {
      setError('Please upload a profile picture')
      return
    }

    if (!accountType) {
      setError('Please select your account type')
      return
    }

    setIsLoading(true)

    try {
      // First, upload the profile picture
      let profilePictureUrl = null
      if (profilePicture) {
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
        profilePictureUrl = uploadData.url
      }

      // Then, register the user with the profile picture URL and account type
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, profilePicture: profilePictureUrl, accountType: accountType || 'OTHER' }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to register')
        return
      }

      // Cookie is set automatically by server, just redirect
      router.push('/dashboard')
      router.refresh() // Refresh to ensure cookie is recognized
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Picture Upload */}
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
              required
              className="w-full px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              JPEG, PNG, GIF, or WebP (max 5MB)
            </p>
          </div>
        </div>
      </div>

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
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Work Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="accountType" className="block text-sm font-medium mb-2">
          Are you a? <span className="text-red-500">*</span>
        </label>
        <select
          id="accountType"
          value={accountType}
          onChange={(e) => setAccountType(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors bg-white dark:bg-gray-800"
        >
          <option value="">Select...</option>
          <option value="PRODUCER">Producer</option>
          <option value="CREATIVE">Creative</option>
          <option value="CLIENT">Client</option>
          <option value="OTHER">Other</option>
        </select>
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
          minLength={6}
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="Write any password (at least 6 characters)"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Use any password you&apos;d like - just remember it!
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-4 py-3 rounded-lg border-2 border-purple-200 focus:border-purple-500 focus:outline-none transition-colors"
          placeholder="Confirm your password"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        Create Account
      </Button>
    </form>
  )
}
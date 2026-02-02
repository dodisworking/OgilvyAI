'use client'

import { useState } from 'react'
import CustomAvatarSprite from './CustomAvatarSprite'
import Button from '../UI/Button'

interface AvatarData {
  gender: 'male' | 'female'
  skinColor: string
  hairColor: string
  hairStyle: 'short' | 'medium' | 'long' | 'spiky' | 'mohawk' | 'afro' | 'ponytail' | 'braids' | 'mullet' | 'bald' | 'curly' | 'bob' | 'pigtails' | 'bun' | 'dreadlocks'
  shirtColor: string
  pantsColor: string
  shoesColor: string
}

interface AvatarMakerProps {
  onSave: (avatarData: AvatarData) => void
  onClose: () => void
  existingAvatar?: AvatarData | null
}

const SKIN_COLORS = ['#fdbcb4', '#fd9d9d', '#d08b5b', '#ae5d29', '#6b4423']
const HAIR_COLORS = ['#000000', '#8b4513', '#ffd700', '#ff6347', '#4169e1', '#9370db', '#ffffff']
const CLOTHES_COLORS = ['#ff0000', '#0000ff', '#00ff00', '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080', '#008000']

export default function AvatarMaker({ onSave, onClose, existingAvatar }: AvatarMakerProps) {
  const [avatarData, setAvatarData] = useState<AvatarData>(
    existingAvatar || {
      gender: 'male',
      skinColor: '#fdbcb4',
      hairColor: '#000000',
      hairStyle: 'short',
      shirtColor: '#ff0000',
      pantsColor: '#0000ff',
      shoesColor: '#000000',
    }
  )

  const handleSave = () => {
    onSave(avatarData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            🎨 Create Your Avatar
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Customize your character like Pokemon!
          </p>
        </div>

        {/* Preview */}
        <div className="mb-8 flex justify-center">
          <div className="bg-gray-100 dark:bg-gray-700 p-8 rounded-lg border-2 border-purple-300">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Down</p>
                <CustomAvatarSprite direction="down" avatarData={avatarData} />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Up</p>
                <CustomAvatarSprite direction="up" avatarData={avatarData} />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Left</p>
                <CustomAvatarSprite direction="left" avatarData={avatarData} />
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Right</p>
                <CustomAvatarSprite direction="right" avatarData={avatarData} />
              </div>
            </div>
          </div>
        </div>

        {/* Customization Options */}
        <div className="space-y-6">
          {/* Gender */}
          <div>
            <label className="block text-sm font-medium mb-2">Gender</label>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map((gender) => (
                <button
                  key={gender}
                  onClick={() => setAvatarData({ ...avatarData, gender })}
                  className={`px-6 py-3 rounded-lg border-2 transition-all flex items-center gap-2 ${
                    avatarData.gender === gender
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="text-2xl">{gender === 'male' ? '👨' : '👩'}</span>
                  <span>{gender.charAt(0).toUpperCase() + gender.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skin Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Skin Color</label>
            <div className="flex gap-2 flex-wrap">
              {SKIN_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarData({ ...avatarData, skinColor: color })}
                  className={`w-10 h-10 rounded border-2 ${
                    avatarData.skinColor === color
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Hair Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Hair Color</label>
            <div className="flex gap-2 flex-wrap">
              {HAIR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarData({ ...avatarData, hairColor: color })}
                  className={`w-10 h-10 rounded border-2 ${
                    avatarData.hairColor === color
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Hair Style */}
          <div>
            <label className="block text-sm font-medium mb-2">Hair Style</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {([
                { value: 'short', emoji: '✂️', label: 'Short' },
                { value: 'medium', emoji: '💇', label: 'Medium' },
                { value: 'long', emoji: '💇‍♀️', label: 'Long' },
                { value: 'spiky', emoji: '⚡', label: 'Spiky' },
                { value: 'mohawk', emoji: '🔥', label: 'Mohawk' },
                { value: 'afro', emoji: '🦁', label: 'Afro' },
                { value: 'ponytail', emoji: '🐴', label: 'Ponytail' },
                { value: 'braids', emoji: '🎀', label: 'Braids' },
                { value: 'mullet', emoji: '🤘', label: 'Mullet' },
                { value: 'bald', emoji: '🪒', label: 'Bald' },
                { value: 'curly', emoji: '🌀', label: 'Curly' },
                { value: 'bob', emoji: '💇‍♀️', label: 'Bob' },
                { value: 'pigtails', emoji: '👧', label: 'Pigtails' },
                { value: 'bun', emoji: '🍩', label: 'Bun' },
                { value: 'dreadlocks', emoji: '🎵', label: 'Dreads' },
              ] as const).map(({ value, emoji, label }) => (
                <button
                  key={value}
                  onClick={() => setAvatarData({ ...avatarData, hairStyle: value })}
                  className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                    avatarData.hairStyle === value
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-gray-300 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title={label}
                >
                  <div className="text-lg mb-1">{emoji}</div>
                  <div className="text-xs">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Shirt Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Shirt Color</label>
            <div className="flex gap-2 flex-wrap">
              {CLOTHES_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarData({ ...avatarData, shirtColor: color })}
                  className={`w-10 h-10 rounded border-2 ${
                    avatarData.shirtColor === color
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Pants Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Pants Color</label>
            <div className="flex gap-2 flex-wrap">
              {CLOTHES_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarData({ ...avatarData, pantsColor: color })}
                  className={`w-10 h-10 rounded border-2 ${
                    avatarData.pantsColor === color
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Shoes Color */}
          <div>
            <label className="block text-sm font-medium mb-2">Shoes Color</label>
            <div className="flex gap-2 flex-wrap">
              {CLOTHES_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarData({ ...avatarData, shoesColor: color })}
                  className={`w-10 h-10 rounded border-2 ${
                    avatarData.shoesColor === color
                      ? 'border-purple-600 ring-2 ring-purple-300'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
          >
            Save Avatar
          </Button>
        </div>
      </div>
    </div>
  )
}

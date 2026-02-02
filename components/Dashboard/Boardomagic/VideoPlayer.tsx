'use client'

interface VideoPlayerProps {
  videoUrl: string
  title?: string
}

export default function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">
          {title}
        </h3>
      )}
      <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <video
          controls
          className="w-full h-full"
          src={videoUrl}
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <div className="mt-4 flex gap-2">
        <a
          href={videoUrl}
          download
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Download MP4
        </a>
      </div>
    </div>
  )
}

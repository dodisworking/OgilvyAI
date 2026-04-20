import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'The Tim App',
  description: 'Mobile-friendly requests & master calendar for Tim',
  appleWebApp: {
    capable: true,
    title: 'Tim App',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/tim-app-manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#4f46e5' },
    { media: '(prefers-color-scheme: dark)', color: '#312e81' },
  ],
}

export default function TimAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="tim-app-root min-h-dvh bg-slate-950 text-slate-100 antialiased">
      {children}
    </div>
  )
}

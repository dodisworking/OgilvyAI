// Client-side profile picture compressor.
// Resizes (preserving aspect) and re-encodes to JPEG, stepping quality down
// until the result is under the target size. Profile pics display small, so
// 512x512 / 200KB target is plenty.

export interface CompressOptions {
  maxDimension?: number // longest side in px
  targetBytes?: number // try to stay under this size
  mimeType?: 'image/jpeg' | 'image/webp'
  minQuality?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 512,
  targetBytes: 200 * 1024,
  mimeType: 'image/jpeg',
  minQuality: 0.4,
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encode failed'))),
      type,
      quality
    )
  })

export async function compressProfileImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const cfg = { ...DEFAULTS, ...opts }

  // GIFs would lose animation if we re-encoded — skip compression and trust source size.
  if (file.type === 'image/gif') return file

  const img = await loadImage(file)

  // Scale longest side down to maxDimension (never upscale)
  const scale = Math.min(1, cfg.maxDimension / Math.max(img.width, img.height))
  let width = Math.max(1, Math.round(img.width * scale))
  let height = Math.max(1, Math.round(img.height * scale))

  let blob: Blob | null = null
  let quality = 0.85

  // Try shrinking quality first, then dimensions if still too big.
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    // White background avoids ugly black where transparent PNG → JPEG loses alpha.
    if (cfg.mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
    }
    ctx.drawImage(img, 0, 0, width, height)

    blob = await canvasToBlob(canvas, cfg.mimeType, quality)
    if (blob.size <= cfg.targetBytes) break

    if (quality > cfg.minQuality + 0.05) {
      quality = Math.max(cfg.minQuality, quality - 0.15)
    } else {
      // Quality bottomed out — shrink dimensions
      width = Math.max(64, Math.round(width * 0.8))
      height = Math.max(64, Math.round(height * 0.8))
    }
  }

  if (!blob) throw new Error('Could not compress image')

  // If by some miracle the original was already smaller than what we produced
  // (rare, e.g. tiny WebP), keep the original.
  if (blob.size >= file.size && file.size <= cfg.targetBytes) return file

  const ext = cfg.mimeType === 'image/webp' ? 'webp' : 'jpg'
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'profile'
  return new File([blob], `${baseName}.${ext}`, { type: cfg.mimeType, lastModified: Date.now() })
}

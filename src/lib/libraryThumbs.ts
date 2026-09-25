import type { FurnitureType } from '../data/floorPlan'

/** Simple silhouette colors per category */
const PALETTE: Record<string, { fill: string; accent: string }> = {
  seating: { fill: '#5b6b7a', accent: '#3a3e44' },
  wood: { fill: '#a89078', accent: '#8a7058' },
  bed: { fill: '#8b9098', accent: '#d2cec6' },
  kitchen: { fill: '#f2f0eb', accent: '#2a2a2a' },
  bath: { fill: '#c5cdd4', accent: '#e8eaed' },
  appliance: { fill: '#e8eaed', accent: '#5a6570' },
  rug: { fill: '#1e3a6e', accent: '#d4c4a8' },
  other: { fill: '#7a8794', accent: '#a89078' },
}

function cat(type: FurnitureType): keyof typeof PALETTE {
  switch (type) {
    case 'sofa':
    case 'sofaPufetto':
    case 'diningChair':
    case 'deskChair':
    case 'officeChair':
      return 'seating'
    case 'diningTable':
    case 'sideboard':
    case 'tvStand':
    case 'nightstand':
    case 'wardrobe':
    case 'bookcase':
    case 'cabinet2Door':
    case 'desk':
    case 'stairs':
    case 'stairStorage':
    case 'stairStorageMirror':
      return 'wood'
    case 'bedDouble':
    case 'bedSingle':
      return 'bed'
    case 'kitchen':
    case 'kitchenCabinet':
    case 'kitchenWallCabinet':
    case 'kitchenWallCorner':
    case 'fridge':
      return 'kitchen'
    case 'bathtub':
    case 'toilet':
    case 'bathSink':
    case 'washBasinVanity':
    case 'mirror':
      return 'bath'
    case 'washer':
    case 'dryer':
    case 'washingMachineModel':
    case 'heatPumpWaterHeater':
      return 'appliance'
    case 'rug':
    case 'areaRug':
      return 'rug'
    default:
      return 'other'
  }
}

/** Draw a type-specific thumbnail into a canvas; returns data URL. */
export function libraryThumbDataUrl(type: FurnitureType, size = 96): string {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const { fill, accent } = PALETTE[cat(type)]!

  // Card background
  ctx.fillStyle = '#2a3036'
  ctx.fillRect(0, 0, size, size)

  const m = size * 0.14
  const cx = size / 2
  const cy = size / 2

  ctx.fillStyle = fill
  ctx.strokeStyle = accent
  ctx.lineWidth = Math.max(1.5, size * 0.02)

  const box = (x: number, y: number, w: number, h: number, r = 4) => {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
    ctx.fill()
  }

  switch (type) {
    case 'sofa':
    case 'sofaPufetto':
      box(m, cy - size * 0.08, size - m * 2, size * 0.28, 6)
      box(m, cy - size * 0.22, size * 0.18, size * 0.36, 4)
      box(size - m - size * 0.18, cy - size * 0.22, size * 0.18, size * 0.36, 4)
      break
    case 'bedDouble':
    case 'bedSingle':
      box(m, m + size * 0.1, size - m * 2, size - m * 2 - size * 0.1, 5)
      ctx.fillStyle = accent
      box(m + 4, m + size * 0.12, size - m * 2 - 8, size * 0.22, 3)
      break
    case 'diningTable':
    case 'desk':
      box(m, cy - size * 0.06, size - m * 2, size * 0.14, 3)
      ctx.fillStyle = accent
      box(m + size * 0.08, cy + size * 0.08, size * 0.08, size * 0.22, 2)
      box(size - m - size * 0.16, cy + size * 0.08, size * 0.08, size * 0.22, 2)
      break
    case 'diningChair':
    case 'deskChair':
    case 'officeChair':
      box(cx - size * 0.18, cy - size * 0.02, size * 0.36, size * 0.14, 3)
      box(cx - size * 0.16, cy - size * 0.28, size * 0.32, size * 0.26, 3)
      break
    case 'kitchen':
    case 'kitchenCabinet':
    case 'kitchenWallCabinet':
      box(m, cy - size * 0.05, size - m * 2, size * 0.32, 3)
      ctx.fillStyle = accent
      box(m + size * 0.08, cy - size * 0.12, size * 0.28, size * 0.08, 2)
      break
    case 'kitchenWallCorner':
      box(m, m + size * 0.35, size * 0.55, size * 0.35, 3)
      box(size - m - size * 0.35, m, size * 0.35, size - m * 2, 3)
      break
    case 'fridge':
    case 'wardrobe':
    case 'bookcase':
    case 'cabinet2Door':
    case 'heatPumpWaterHeater':
      box(cx - size * 0.2, m, size * 0.4, size - m * 2, 4)
      if (type === 'bookcase') {
        ctx.strokeStyle = accent
        for (let i = 1; i <= 4; i++) {
          const y = m + (i / 5) * (size - m * 2)
          ctx.beginPath()
          ctx.moveTo(cx - size * 0.2 + 4, y)
          ctx.lineTo(cx + size * 0.2 - 4, y)
          ctx.stroke()
        }
      } else {
        ctx.strokeRect(cx - size * 0.2 + 3, m + 3, size * 0.4 - 6, size - m * 2 - 6)
      }
      break
    case 'bathtub':
      box(m, cy - size * 0.12, size - m * 2, size * 0.32, 12)
      break
    case 'toilet':
      box(cx - size * 0.14, cy, size * 0.28, size * 0.22, 8)
      box(cx - size * 0.12, cy - size * 0.22, size * 0.24, size * 0.2, 4)
      break
    case 'bathSink':
    case 'washBasinVanity':
      box(m, cy + size * 0.02, size - m * 2, size * 0.28, 3)
      ctx.beginPath()
      ctx.arc(cx, cy - size * 0.02, size * 0.14, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'mirror':
      box(m + size * 0.08, m, size - m * 2 - size * 0.16, size - m * 2, 4)
      ctx.fillStyle = '#9eb8c8'
      box(m + size * 0.14, m + size * 0.08, size - m * 2 - size * 0.28, size - m * 2 - size * 0.16, 2)
      break
    case 'rug':
    case 'areaRug':
      box(m, m + size * 0.12, size - m * 2, size - m * 2 - size * 0.12, 2)
      ctx.strokeStyle = accent
      ctx.strokeRect(m + 4, m + size * 0.12 + 4, size - m * 2 - 8, size - m * 2 - size * 0.12 - 8)
      break
    case 'washer':
    case 'dryer':
    case 'washingMachineModel':
      box(m + size * 0.1, m, size - m * 2 - size * 0.2, size - m * 2, 4)
      ctx.beginPath()
      ctx.arc(cx, cy + size * 0.04, size * 0.16, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()
      break
    case 'stairs':
    case 'stairStorage':
    case 'stairStorageMirror':
      for (let i = 0; i < 4; i++) {
        const t = i / 4
        box(m + t * size * 0.15, m + (3 - i) * size * 0.14, size - m * 2 - t * size * 0.15, size * 0.12, 2)
      }
      break
    case 'tvStand':
      box(m, cy + size * 0.08, size - m * 2, size * 0.18, 3)
      ctx.fillStyle = '#222'
      box(m + size * 0.1, m + size * 0.08, size - m * 2 - size * 0.2, size * 0.32, 2)
      break
    case 'tableLamp':
    case 'vase':
      ctx.beginPath()
      ctx.moveTo(cx - size * 0.12, cy + size * 0.28)
      ctx.lineTo(cx + size * 0.12, cy + size * 0.28)
      ctx.lineTo(cx + size * 0.08, cy - size * 0.05)
      ctx.lineTo(cx - size * 0.08, cy - size * 0.05)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy - size * 0.18, size * 0.12, 0, Math.PI * 2)
      ctx.fillStyle = accent
      ctx.fill()
      break
    default:
      box(m, m, size - m * 2, size - m * 2, 6)
  }

  return canvas.toDataURL('image/png')
}

const cache = new Map<string, string>()

export function getLibraryThumb(type: FurnitureType): string {
  const hit = cache.get(type)
  if (hit) return hit
  const url = libraryThumbDataUrl(type)
  cache.set(type, url)
  return url
}

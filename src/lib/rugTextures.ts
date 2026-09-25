import * as THREE from 'three'

function makeCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 512,
) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  draw(ctx, size)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  map.needsUpdate = true
  return map
}

/** Navy rug with cream border + center medallion (bedroom). */
export function createBedroomRugMap() {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#1e3a6e'
    ctx.fillRect(0, 0, size, size)

    const border = size * 0.08
    ctx.fillStyle = '#d4c4a8'
    ctx.fillRect(0, 0, size, border)
    ctx.fillRect(0, size - border, size, border)
    ctx.fillRect(0, 0, border, size)
    ctx.fillRect(size - border, 0, border, size)

    // Inner navy field
    ctx.fillStyle = '#243f72'
    ctx.fillRect(border, border, size - border * 2, size - border * 2)

    // Soft corner ornaments
    ctx.strokeStyle = 'rgba(212, 196, 168, 0.35)'
    ctx.lineWidth = size * 0.012
    const inset = border * 1.6
    ctx.strokeRect(inset, inset, size - inset * 2, size - inset * 2)

    // Center medallion
    const cx = size / 2
    const cy = size / 2
    ctx.fillStyle = '#8b3a3a'
    ctx.beginPath()
    ctx.ellipse(cx, cy, size * 0.14, size * 0.11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(212, 196, 168, 0.55)'
    ctx.lineWidth = size * 0.01
    ctx.stroke()
  })
}

/** Beige living-area rug with soft rib stripes. */
export function createLivingRugMap() {
  return makeCanvasTexture((ctx, size) => {
    ctx.fillStyle = '#c4bbb0'
    ctx.fillRect(0, 0, size, size)

    const stripes = 11
    for (let i = 0; i < stripes; i++) {
      const t = i / (stripes - 1)
      const y = size * (0.08 + t * 0.84)
      const h = size * 0.035
      ctx.fillStyle = i % 2 === 0 ? '#cec5b8' : '#b7aea2'
      ctx.fillRect(size * 0.03, y - h / 2, size * 0.94, h)
    }

    // Soft outer edge darken
    const edge = ctx.createLinearGradient(0, 0, 0, size)
    edge.addColorStop(0, 'rgba(100, 90, 80, 0.12)')
    edge.addColorStop(0.08, 'rgba(100, 90, 80, 0)')
    edge.addColorStop(0.92, 'rgba(100, 90, 80, 0)')
    edge.addColorStop(1, 'rgba(100, 90, 80, 0.12)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, size, size)
  })
}

let bedroomRugMap: THREE.CanvasTexture | null = null
let livingRugMap: THREE.CanvasTexture | null = null

export function getBedroomRugMap() {
  if (!bedroomRugMap) bedroomRugMap = createBedroomRugMap()
  return bedroomRugMap
}

export function getLivingRugMap() {
  if (!livingRugMap) livingRugMap = createLivingRugMap()
  return livingRugMap
}

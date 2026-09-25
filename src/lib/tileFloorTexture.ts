import * as THREE from 'three'
import { WOOD_TILE_METERS, configureFloorTexture } from './woodFloorTexture'

/** World size (m) covered by one tile texture — 2×2 of 60 cm tiles. */
export const TILE_FLOOR_METERS = 1.2

/** UV repeat so shared wood-meter UVs map correctly onto the tile atlas. */
export const TILE_UV_REPEAT = WOOD_TILE_METERS / TILE_FLOOR_METERS

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount))
  const b = Math.min(255, Math.max(0, (n & 255) + amount))
  return `rgb(${r},${g},${b})`
}

/**
 * Large ceramic floor tiles (~60×60 cm) with grout, soft variation, and gloss roughness.
 */
export function createTileFloorMaps(baseColor = '#6a737c'): {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
} {
  const size = 512
  const grid = 2 // 2×2 large tiles in the atlas
  const cell = size / grid
  const grout = Math.max(3, Math.round(size * 0.012))

  const albedo = document.createElement('canvas')
  albedo.width = size
  albedo.height = size
  const aCtx = albedo.getContext('2d')!

  const rough = document.createElement('canvas')
  rough.width = size
  rough.height = size
  const rCtx = rough.getContext('2d')!

  // Grout base
  aCtx.fillStyle = shade(baseColor, -48)
  aCtx.fillRect(0, 0, size, size)
  rCtx.fillStyle = '#f2f2f2'
  rCtx.fillRect(0, 0, size, size)

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const seed = hash(row * 11.3 + col * 7.1 + 2.4)
      const tone = Math.floor((seed - 0.5) * 22)
      const x = col * cell + grout / 2
      const y = row * cell + grout / 2
      const w = cell - grout
      const h = cell - grout

      // Tile body with subtle diagonal shade
      const grad = aCtx.createLinearGradient(x, y, x + w, y + h)
      grad.addColorStop(0, shade(baseColor, tone + 12))
      grad.addColorStop(0.45, shade(baseColor, tone))
      grad.addColorStop(1, shade(baseColor, tone - 10))
      aCtx.fillStyle = grad
      aCtx.fillRect(x, y, w, h)

      // Soft bevel / edge highlight
      aCtx.strokeStyle = `rgba(255,255,255,${0.08 + seed * 0.06})`
      aCtx.lineWidth = 2
      aCtx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3)
      aCtx.strokeStyle = `rgba(0,0,0,${0.08 + seed * 0.05})`
      aCtx.strokeRect(x + 3, y + 3, w - 6, h - 6)

      // Speckle / ceramic noise
      for (let i = 0; i < 90; i++) {
        const px = x + hash(seed * 40 + i) * w
        const py = y + hash(seed * 70 + i * 3) * h
        const pr = 0.6 + hash(i + col) * 1.8
        aCtx.fillStyle = `rgba(255,255,255,${0.015 + hash(i) * 0.04})`
        aCtx.beginPath()
        aCtx.arc(px, py, pr, 0, Math.PI * 2)
        aCtx.fill()
        if (hash(i * 1.7) > 0.65) {
          aCtx.fillStyle = `rgba(20,24,28,${0.02 + hash(i * 2) * 0.035})`
          aCtx.beginPath()
          aCtx.arc(px + 1, py + 1, pr * 0.7, 0, Math.PI * 2)
          aCtx.fill()
        }
      }

      // Occasional faint mineral streak
      if (seed > 0.55) {
        aCtx.save()
        aCtx.beginPath()
        aCtx.rect(x, y, w, h)
        aCtx.clip()
        aCtx.strokeStyle = `rgba(255,255,255,${0.04 + seed * 0.05})`
        aCtx.lineWidth = 1.5 + seed * 2
        aCtx.beginPath()
        const y0 = y + hash(seed * 9) * h
        aCtx.moveTo(x, y0)
        aCtx.quadraticCurveTo(
          x + w * 0.5,
          y0 + (hash(seed * 5) - 0.5) * h * 0.25,
          x + w,
          y0 + (hash(seed * 3) - 0.5) * h * 0.2,
        )
        aCtx.stroke()
        aCtx.restore()
      }

      // Roughness: glossy tile face, matte grout already drawn
      const gloss = Math.floor(70 + seed * 35)
      rCtx.fillStyle = `rgb(${gloss},${gloss},${gloss})`
      rCtx.fillRect(x, y, w, h)

      // Slightly less glossy near edges
      rCtx.strokeStyle = `rgb(${gloss + 25},${gloss + 25},${gloss + 25})`
      rCtx.lineWidth = 4
      rCtx.strokeRect(x + 2, y + 2, w - 4, h - 4)
    }
  }

  const map = configureFloorTexture(new THREE.CanvasTexture(albedo), { color: true })
  map.repeat.set(TILE_UV_REPEAT, TILE_UV_REPEAT)

  const roughnessMap = configureFloorTexture(new THREE.CanvasTexture(rough))
  roughnessMap.repeat.set(TILE_UV_REPEAT, TILE_UV_REPEAT)

  return { map, roughnessMap }
}

import * as THREE from 'three'

/** World-space size (m) covered by one texture tile.
 *  Slightly larger = fewer repeats = less grazing-angle shimmer. */
export const WOOD_TILE_METERS = 3.2

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

/** Stable sampling for floors viewed at shallow angles / distance. */
export function configureFloorTexture(
  tex: THREE.Texture,
  {
    color = false,
    anisotropy = 16,
  }: { color?: boolean; anisotropy?: number } = {},
) {
  if (color) tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}

/**
 * Procedural oak-style plank albedo + matching roughness map.
 * Seamless along both axes; plank length runs vertically in UV.
 */
export function createWoodFloorMaps(baseColor = '#d4c4a8'): {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
} {
  const size = 512
  const plankCount = 8
  const plankW = size / plankCount

  const albedo = document.createElement('canvas')
  albedo.width = size
  albedo.height = size
  const aCtx = albedo.getContext('2d')!

  const rough = document.createElement('canvas')
  rough.width = size
  rough.height = size
  const rCtx = rough.getContext('2d')!

  // Fill base
  aCtx.fillStyle = baseColor
  aCtx.fillRect(0, 0, size, size)
  rCtx.fillStyle = '#c8c8c8'
  rCtx.fillRect(0, 0, size, size)

  for (let i = 0; i < plankCount; i++) {
    const x0 = i * plankW
    const seed = hash(i * 17.13 + 3.7)
    const tone = Math.floor((seed - 0.5) * 28)
    const plankColor = shade(baseColor, tone)

    // Plank body with slight vertical gradient bands
    const grad = aCtx.createLinearGradient(x0, 0, x0 + plankW, 0)
    grad.addColorStop(0, shade(baseColor, tone - 8))
    grad.addColorStop(0.45, plankColor)
    grad.addColorStop(1, shade(baseColor, tone + 6))
    aCtx.fillStyle = grad
    aCtx.fillRect(x0, 0, plankW, size)

    // Grain streaks — softer so mips don't moiré
    aCtx.save()
    aCtx.beginPath()
    aCtx.rect(x0 + 1, 0, plankW - 2, size)
    aCtx.clip()
    for (let g = 0; g < 18; g++) {
      const gx = x0 + 2 + hash(i * 40 + g) * (plankW - 4)
      const gy = hash(i * 90 + g * 3) * size
      const glen = 40 + hash(i + g * 7) * 120
      const amp = 1.2 + hash(g + i) * 2.5
      aCtx.strokeStyle = `rgba(60, 40, 20, ${0.03 + hash(g) * 0.05})`
      aCtx.lineWidth = 0.8 + hash(g * 1.3) * 1.6
      aCtx.beginPath()
      aCtx.moveTo(gx, gy)
      for (let t = 0; t < glen; t += 4) {
        const yy = (gy + t) % size
        const xx = gx + Math.sin((t + seed * 40) * 0.08) * amp
        aCtx.lineTo(xx, yy)
      }
      aCtx.stroke()
    }
    aCtx.restore()

    // Knots (sparse)
    if (seed > 0.72) {
      const kx = x0 + plankW * (0.25 + hash(i * 5) * 0.5)
      const ky = hash(i * 11.2) * size
      const kr = 3 + hash(i * 2.2) * 5
      const knot = aCtx.createRadialGradient(kx, ky, 0, kx, ky, kr)
      knot.addColorStop(0, 'rgba(70, 45, 25, 0.35)')
      knot.addColorStop(0.6, 'rgba(90, 60, 35, 0.15)')
      knot.addColorStop(1, 'rgba(90, 60, 35, 0)')
      aCtx.fillStyle = knot
      aCtx.beginPath()
      aCtx.ellipse(kx, ky, kr * 0.7, kr, seed * Math.PI, 0, Math.PI * 2)
      aCtx.fill()
    }

    // Roughness: planks slightly different, seams rougher
    const rTone = Math.floor(160 + seed * 50)
    rCtx.fillStyle = `rgb(${rTone},${rTone},${rTone})`
    rCtx.fillRect(x0, 0, plankW, size)

    // Soft plank gap (avoid 1px hard lines that shimmer at distance)
    const gapGrad = aCtx.createLinearGradient(x0 + plankW - 3, 0, x0 + plankW, 0)
    gapGrad.addColorStop(0, 'rgba(40, 28, 16, 0)')
    gapGrad.addColorStop(0.55, 'rgba(40, 28, 16, 0.28)')
    gapGrad.addColorStop(1, 'rgba(40, 28, 16, 0.4)')
    aCtx.fillStyle = gapGrad
    aCtx.fillRect(x0 + plankW - 3, 0, 3, size)
    rCtx.fillStyle = '#e4e4e4'
    rCtx.fillRect(x0 + plankW - 2.5, 0, 2.5, size)

    // End joints staggered per plank — soft bands
    const jointCount = 2 + Math.floor(hash(i * 8) * 2)
    for (let j = 0; j < jointCount; j++) {
      const jy = ((hash(i * 13 + j * 19) + j / jointCount) % 1) * size
      aCtx.fillStyle = 'rgba(35, 24, 14, 0.22)'
      aCtx.fillRect(x0, jy, plankW, 2)
      rCtx.fillStyle = '#e0e0e0'
      rCtx.fillRect(x0, jy, plankW, 2)
    }
  }

  // Soft overall film grain (low amplitude — mip-friendly)
  const img = aCtx.getImageData(0, 0, size, size)
  const data = img.data
  for (let p = 0; p < data.length; p += 4) {
    const n = (hash(p * 0.01) - 0.5) * 6
    data[p] = Math.min(255, Math.max(0, data[p]! + n))
    data[p + 1] = Math.min(255, Math.max(0, data[p + 1]! + n * 0.9))
    data[p + 2] = Math.min(255, Math.max(0, data[p + 2]! + n * 0.7))
  }
  aCtx.putImageData(img, 0, 0)

  const map = configureFloorTexture(new THREE.CanvasTexture(albedo), { color: true })
  const roughnessMap = configureFloorTexture(new THREE.CanvasTexture(rough))

  return { map, roughnessMap }
}

/** Outdoor deck planks (grayer / weathered) for terrace rooms. */
export function createDeckFloorMaps(baseColor = '#9a8b74'): {
  map: THREE.CanvasTexture
  roughnessMap: THREE.CanvasTexture
} {
  return createWoodFloorMaps(baseColor)
}

/** Assign meter-based UVs so wood tiles consistently across rooms (XZ). */
export function applyWorldFloorUVs(geometry: THREE.BufferGeometry, metersPerTile = WOOD_TILE_METERS) {
  const pos = geometry.getAttribute('position')
  if (!pos) return
  const uvs = new Float32Array(pos.count * 2)
  const inv = 1 / metersPerTile
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    uvs[i * 2] = x * inv
    uvs[i * 2 + 1] = z * inv
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
}

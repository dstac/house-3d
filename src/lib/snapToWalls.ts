import {
  DEFAULT_WALL_THICKNESS,
  WALLS,
  wallInwardNormal,
  type FurnitureDef,
  type WallSeg,
} from '../data/floorPlan'

const WALL_SNAP = 0.16
const ALIGN_SNAP = 0.1
const GAP = 0.02

export interface SnapGuide {
  /** Vertical guide at world X, or horizontal at world Z */
  axis: 'x' | 'z'
  at: number
}

export interface SnapResult {
  x: number
  z: number
  guides: SnapGuide[]
}

interface Extent {
  cx: number
  cz: number
  left: number
  right: number
  south: number
  north: number
}

function extents(
  x: number,
  z: number,
  size: [number, number, number],
  rotation: number,
): Extent {
  const [w, , d] = size
  const c = Math.cos(rotation)
  const s = Math.sin(rotation)
  const hx = (w / 2) * Math.abs(c) + (d / 2) * Math.abs(s)
  const hz = (w / 2) * Math.abs(s) + (d / 2) * Math.abs(c)
  return {
    cx: x,
    cz: z,
    left: x - hx,
    right: x + hx,
    south: z - hz,
    north: z + hz,
  }
}

/** Face positions along the wall normal (actual faces, not centerline). */
function wallFacePositions(wall: WallSeg, allWalls: WallSeg[]): number[] {
  const t = wall.thickness ?? DEFAULT_WALL_THICKNESS
  const [ax, az] = wall.a
  const [bx, bz] = wall.b
  const dx = bx - ax
  const dz = bz - az

  if (wall.centerline) {
    if (Math.abs(dz) < 1e-6) {
      const zc = (az + bz) / 2
      return [zc - t / 2, zc + t / 2]
    }
    if (Math.abs(dx) < 1e-6) {
      const xc = (ax + bx) / 2
      return [xc - t / 2, xc + t / 2]
    }
    return []
  }

  // Outer-edge model: a→b is outer face; thickness fully inward
  const { ix, iz } = wallInwardNormal(wall, allWalls)
  if (Math.abs(dz) < 1e-6) {
    const zOuter = az
    return [zOuter, zOuter + iz * t]
  }
  if (Math.abs(dx) < 1e-6) {
    const xOuter = ax
    return [xOuter, xOuter + ix * t]
  }
  return []
}

/** Soft snap to walls + align to other furniture; returns exact stick positions and guide lines. */
export function snapFurnitureMove(
  x: number,
  z: number,
  size: [number, number, number],
  rotation: number,
  options?: {
    walls?: WallSeg[]
    others?: FurnitureDef[]
    wallSnap?: number
    alignSnap?: number
  },
): SnapResult {
  const walls = options?.walls ?? WALLS
  const others = options?.others ?? []
  const wallSnap = options?.wallSnap ?? WALL_SNAP
  const alignSnap = options?.alignSnap ?? ALIGN_SNAP

  const self = extents(x, z, size, rotation)
  const hx = self.cx - self.left
  const hz = self.cz - self.south

  const xTargets: { center: number; guide: number; thresh: number }[] = []
  const zTargets: { center: number; guide: number; thresh: number }[] = []

  for (const wall of walls) {
    if (wall.glass) continue
    const [ax, az] = wall.a
    const [bx, bz] = wall.b
    const dx = bx - ax
    const dz = bz - az
    const pad = Math.max(hx, hz) + 0.4
    const faces = wallFacePositions(wall, walls)
    if (!faces.length) continue

    if (Math.abs(dz) < 1e-6) {
      const x0 = Math.min(ax, bx) - pad
      const x1 = Math.max(ax, bx) + pad
      if (x < x0 || x > x1) continue
      for (const faceZ of faces) {
        // Furniture south edge flush to face (item north of wall face)
        zTargets.push({ center: faceZ + hz + GAP, guide: faceZ, thresh: wallSnap })
        // Furniture north edge flush to face (item south of wall face)
        zTargets.push({ center: faceZ - hz - GAP, guide: faceZ, thresh: wallSnap })
      }
    } else if (Math.abs(dx) < 1e-6) {
      const z0 = Math.min(az, bz) - pad
      const z1 = Math.max(az, bz) + pad
      if (z < z0 || z > z1) continue
      for (const faceX of faces) {
        xTargets.push({ center: faceX + hx + GAP, guide: faceX, thresh: wallSnap })
        xTargets.push({ center: faceX - hx - GAP, guide: faceX, thresh: wallSnap })
      }
    }
  }

  for (const o of others) {
    const e = extents(o.position[0], o.position[2], o.size, o.rotation)
    // center align
    xTargets.push({ center: e.cx, guide: e.cx, thresh: alignSnap })
    zTargets.push({ center: e.cz, guide: e.cz, thresh: alignSnap })
    // edge-to-edge / edge-to-center
    xTargets.push({ center: e.left + hx, guide: e.left, thresh: alignSnap })
    xTargets.push({ center: e.right - hx, guide: e.right, thresh: alignSnap })
    xTargets.push({ center: e.left - hx, guide: e.left, thresh: alignSnap })
    xTargets.push({ center: e.right + hx, guide: e.right, thresh: alignSnap })
    zTargets.push({ center: e.south + hz, guide: e.south, thresh: alignSnap })
    zTargets.push({ center: e.north - hz, guide: e.north, thresh: alignSnap })
    zTargets.push({ center: e.south - hz, guide: e.south, thresh: alignSnap })
    zTargets.push({ center: e.north + hz, guide: e.north, thresh: alignSnap })
  }

  let bestX = x
  let bestZ = z
  let bestDx = Infinity
  let bestDz = Infinity
  let guideX: number | undefined
  let guideZ: number | undefined

  for (const t of xTargets) {
    const d = Math.abs(x - t.center)
    if (d < t.thresh && d < bestDx) {
      bestDx = d
      bestX = t.center
      guideX = t.guide
    }
  }
  for (const t of zTargets) {
    const d = Math.abs(z - t.center)
    if (d < t.thresh && d < bestDz) {
      bestDz = d
      bestZ = t.center
      guideZ = t.guide
    }
  }

  const guides: SnapGuide[] = []
  if (guideX != null) guides.push({ axis: 'x', at: guideX })
  if (guideZ != null) guides.push({ axis: 'z', at: guideZ })

  return { x: bestX, z: bestZ, guides }
}

/** Soft wall snap: pulls flush when close, never blocks movement through walls. */
export function snapFurniturePosition(
  x: number,
  z: number,
  size: [number, number, number],
  rotation: number,
  walls: WallSeg[] = WALLS,
  others: FurnitureDef[] = [],
): [number, number] {
  const r = snapFurnitureMove(x, z, size, rotation, { walls, others })
  return [r.x, r.z]
}

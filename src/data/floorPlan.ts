/**
 * Floor plan from dimensioned PDF (cm → m).
 * Origin = SW corner of exterior outline. North = +Z.
 *
 * Top:    BR1 4.60 × 3.38  |  BR2 3.27 × 3.38
 * Left:   Living height 6.37
 * Right:  Office 2.28 × 2.72  /  Bath 2.28 × 3.50
 * Bottom: Living 3.45  |  Hall 1.99  |  Bath 2.28
 * Stairs clear width 0.85 · entry door 1.00
 */

/** Patio / display glazing clear height (m) — shared by living door & display window */
export const PATIO_OPENING_H = 2.2

/** Wall-mounted TV screen size (m) */
export const TV_SCREEN_W = 1.8
export const TV_SCREEN_H = 1.08

export const WALL_THICK = 0.25
export const PARTITION = 0.12

/** Clear interior sizes (m) from plan */
const BR1_W = 4.6
const BR2_W = 3.27
const BR_D = 3.38
const LIVING_D = 6.37
const LIVING_SOUTH_W = 3.45
const HALL_W = 1.99
const HALL_D = 2.19 // 4.36 m² / 1.99
const RIGHT_W = 2.28
const OFFICE_D = 2.72
const BATH_D = 3.5
const STAIR_W = 0.85
const STAIR_RUN = 2.0 // tread run north from entrance
const ENTRY_W = 1.0

/** Stairs clear width / run (m) — shared by procedural stairs & GLB stair assets */
export const STAIRS_SIZE: [number, number, number] = [STAIR_W, 2.6, STAIR_RUN]

const I = WALL_THICK
/** Interior clear width / depth */
const INT_W = BR1_W + PARTITION + BR2_W
const INT_D = LIVING_D + PARTITION + BR_D

export const BUILDING = {
  w: I + INT_W + I,
  d: I + INT_D + I,
  centerX: (I + INT_W + I) / 2,
  centerZ: (I + INT_D + I) / 2,
}

/** Alias for the hard-coded apartment footprint (legacy / migration). */
export const DEFAULT_BUILDING = BUILDING

export type BuildingBounds = {
  w: number
  d: number
  centerX: number
  centerZ: number
  minX: number
  minZ: number
}

/** Empty-canvas size when a plan has no walls yet. */
export const EMPTY_BUILDING: BuildingBounds = {
  w: 10,
  d: 8,
  centerX: 5,
  centerZ: 4,
  minX: 0,
  minZ: 0,
}

export const DEFAULT_WALL_THICKNESS = 0.2


const W = BUILDING.w
const D = BUILDING.d

const BR1_X = I + BR1_W
const RX = I + LIVING_SOUTH_W + PARTITION + HALL_W // bath/office west face
const HALL_X = I + LIVING_SOUTH_W + PARTITION
const TOP_Z = I + LIVING_D
const MID_Z = I + BATH_D
const HALL_Z = I + HALL_D
const NORTH = D - I

export type RoomId =
  | 'bedroom1'
  | 'bedroom2'
  | 'living'
  | 'office'
  | 'bathroom'
  | 'hall'

export interface RoomDef {
  id: RoomId
  name: string
  area: number
  /** Exact clear L×W from plan (depth × width) */
  length: number
  width: number
  polygon: [number, number][]
  color: string
  labelAt: [number, number]
  floorKind?: 'wood' | 'tile'
}

export type OpeningKind = 'door' | 'window'

export interface OpeningDef {
  id: string
  label: string
  kind: OpeningKind
  t0: number
  t1: number
  /** Window sill height (m) */
  sill?: number
  /** Window clear height (m); defaults to a typical mid-wall pane */
  height?: number
  /** display = large picture window; french = 2-pane glazed door; gate = terrace fence gate */
  style?: 'display' | 'french' | 'gate'
}

export interface WallSeg {
  id: string
  label: string
  a: [number, number]
  b: [number, number]
  thickness: number
  openings?: OpeningDef[]
  exterior?: boolean
  /** Translucent glass partition (e.g. bath screen) */
  glass?: boolean
  /** Override wall height for glass screens (m) */
  screenHeight?: number
  /**
   * When true, a→b is the wall centerline (legacy default apartment).
   * When false/omitted, a→b is the outer edge (custom drawn plans).
   */
  centerline?: boolean
  /**
   * Explicit thickness side for outer-edge walls: +1 = body on +n of a→b
   * (n = (-dz, dx), i.e. left of travel with north up), -1 = right of travel.
   * When absent the side is inferred (toward plan centroid).
   */
  side?: 1 | -1
}

export type FurnitureType =
  | 'sofa'
  | 'tvStand'
  | 'diningTable'
  | 'diningChair'
  | 'sideboard'
  | 'bedDouble'
  | 'bedSingle'
  | 'nightstand'
  | 'wardrobe'
  | 'bookcase'
  | 'desk'
  | 'deskChair'
  | 'officeChair'
  | 'kitchen'
  | 'kitchenCabinet'
  | 'kitchenWallCabinet'
  | 'kitchenWallCorner'
  | 'fridge'
  | 'bathtub'
  | 'toilet'
  | 'bathSink'
  | 'washer'
  | 'dryer'
  | 'stairs'
  | 'stairStorage'
  | 'stairStorageMirror'
  | 'rug'
  | 'areaRug'
  | 'tableLamp'
  | 'vase'
  | 'mirror'
  | 'sofaPufetto'
  | 'cabinet2Door'
  | 'washingMachineModel'
  | 'heatPumpWaterHeater'
  | 'washBasinVanity'

export interface FurnitureDef {
  id: string
  type: FurnitureType
  label: string
  position: [number, number, number]
  rotation: number
  size: [number, number, number]
  /** Optional per-piece upholstery / primary color */
  color?: string
  /** Optional per-piece wood / accent color */
  accentColor?: string
  /**
   * 2D plan look: `box` = plain footprint (default / classic),
   * `symbol` = simple object icon.
   */
  planIcon?: 'box' | 'symbol'
}

/** Ceiling-mounted lighting on the reflected ceiling plan */
export type CeilingLightKind = 'strip' | 'industrial' | 'globe'

export interface CeilingLightDef {
  id: string
  kind: CeilingLightKind
  label: string
  /** Plan center (x, z) */
  position: [number, number]
  /** Yaw (rad) — strip length along local +X */
  rotation: number
  /**
   * Strip: [length, width] on plan.
   * Industrial / globe: [diameter, diameter].
   */
  size: [number, number]
  /** Pendant drop from ceiling underside (m); strips / flush globe ignore */
  drop?: number
}

export function createCeilingLightId(kind: CeilingLightKind): string {
  return `ceil-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Build an LED strip from two plan endpoints (drawn length). */
export function makeStripFromEndpoints(
  a: [number, number],
  b: [number, number],
  width = 0.07,
): CeilingLightDef | null {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const len = Math.hypot(dx, dz)
  if (len < 0.12) return null
  // Local +X maps to world (cos θ, −sin θ) on the 2D plan
  const rotation = Math.atan2(-dz, dx)
  return {
    id: createCeilingLightId('strip'),
    kind: 'strip',
    label: 'LED strip',
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    rotation,
    size: [len, width],
  }
}

export function makeCeilingLight(
  kind: CeilingLightKind,
  x: number,
  z: number,
): CeilingLightDef {
  if (kind === 'strip') {
    return {
      id: createCeilingLightId('strip'),
      kind: 'strip',
      label: 'LED strip',
      position: [x, z],
      rotation: 0,
      size: [1.4, 0.07],
    }
  }
  if (kind === 'globe') {
    return {
      id: createCeilingLightId('globe'),
      kind: 'globe',
      label: 'Flush globe',
      position: [x, z],
      rotation: 0,
      size: [0.32, 0.32],
      drop: 0.12,
    }
  }
  return {
    id: createCeilingLightId('industrial'),
    kind: 'industrial',
    label: 'Industrial pendant',
    position: [x, z],
    rotation: 0,
    size: [0.38, 0.38],
    drop: 0.9,
  }
}

export function roomApproxSize(polygon: [number, number][]) {
  const xs = polygon.map((p) => p[0])
  const zs = polygon.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  return {
    width: maxX - minX,
    depth: maxZ - minZ,
    minX,
    maxX,
    minZ,
    maxZ,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
  }
}

export const ROOMS: RoomDef[] = [
  {
    id: 'bedroom1',
    name: 'Bedroom',
    area: 15.55,
    length: BR_D,
    width: BR1_W,
    polygon: [
      [I, TOP_Z + PARTITION],
      [BR1_X, TOP_Z + PARTITION],
      [BR1_X, NORTH],
      [I, NORTH],
    ],
    color: '#e8dcc8',
    labelAt: [I + BR1_W / 2, TOP_Z + PARTITION + BR_D / 2],
    floorKind: 'wood',
  },
  {
    id: 'bedroom2',
    name: 'Bedroom',
    area: 11.05,
    length: BR_D,
    width: BR2_W,
    polygon: [
      [BR1_X + PARTITION, TOP_Z + PARTITION],
      [W - I, TOP_Z + PARTITION],
      [W - I, NORTH],
      [BR1_X + PARTITION, NORTH],
    ],
    color: '#dce6ef',
    labelAt: [BR1_X + PARTITION + BR2_W / 2, TOP_Z + PARTITION + BR_D / 2],
    floorKind: 'wood',
  },
  {
    id: 'office',
    name: 'Office',
    area: 6.2,
    length: OFFICE_D,
    width: RIGHT_W,
    polygon: [
      [RX + PARTITION / 2, MID_Z + PARTITION],
      [W - I, MID_Z + PARTITION],
      [W - I, TOP_Z],
      [RX + PARTITION / 2, TOP_Z],
    ],
    color: '#e2ddd4',
    labelAt: [RX + RIGHT_W / 2, MID_Z + PARTITION + OFFICE_D / 2],
    floorKind: 'wood',
  },
  {
    id: 'bathroom',
    name: 'Sanmazgas',
    area: 7.98,
    length: BATH_D,
    width: RIGHT_W,
    polygon: [
      [RX + PARTITION / 2, I],
      [W - I, I],
      [W - I, MID_Z],
      [RX + PARTITION / 2, MID_Z],
    ],
    color: '#c5cdd4',
    labelAt: [RX + RIGHT_W / 2, I + BATH_D / 2],
    floorKind: 'tile',
  },
  {
    id: 'hall',
    name: 'Hall / stairs',
    area: 4.36,
    length: HALL_D,
    width: HALL_W,
    polygon: [
      [HALL_X, I],
      [RX, I],
      [RX, HALL_Z],
      [HALL_X, HALL_Z],
    ],
    color: '#ebe6df',
    labelAt: [HALL_X + HALL_W / 2, I + HALL_D / 2 + 0.3],
    floorKind: 'wood',
  },
  {
    id: 'living',
    name: 'Living · kitchen',
    area: 30.92,
    length: LIVING_D,
    width: BR1_W,
    polygon: [
      [I, I],
      [HALL_X, I],
      [HALL_X, HALL_Z],
      [RX, HALL_Z],
      [RX, TOP_Z],
      [I, TOP_Z],
    ],
    color: '#f0ebe3',
    labelAt: [I + LIVING_SOUTH_W / 2, I + LIVING_D / 2],
    floorKind: 'wood',
  },
]

/** Entry door on south wall into hall corridor (east of stairs) */
const entryCenterX = HALL_X + STAIR_W + PARTITION + (HALL_W - STAIR_W - PARTITION) / 2
const entryT0 = (entryCenterX - ENTRY_W / 2) / W
const entryT1 = (entryCenterX + ENTRY_W / 2) / W

export const WALLS: WallSeg[] = [
  {
    id: 'ext-south',
    label: 'South wall',
    // Centerline so inner face = I (matches room floors)
    a: [0, I / 2],
    b: [W, I / 2],
    thickness: WALL_THICK,
    exterior: true,
    openings: [
      { id: 'win-kitchen-1', label: 'Kitchen window 1', kind: 'window', t0: 0.06, t1: 0.16, sill: 0.95 },
      { id: 'win-kitchen-2', label: 'Kitchen window 2', kind: 'window', t0: 0.2, t1: 0.3, sill: 0.95 },
      { id: 'door-entry', label: 'Main entrance', kind: 'door', t0: entryT0, t1: entryT1 },
    ],
  },
  {
    id: 'ext-east',
    label: 'East wall',
    a: [W - I / 2, 0],
    b: [W - I / 2, D],
    thickness: WALL_THICK,
    exterior: true,
    openings: [
      { id: 'win-bath', label: 'Bathroom window', kind: 'window', t0: 0.155, t1: 0.205, sill: 1.55, height: 0.4 },
      { id: 'win-office', label: 'Office window', kind: 'window', t0: 0.43, t1: 0.485, sill: 1.45, height: 0.5 },
      { id: 'win-br2-east', label: 'Bedroom 2 east window', kind: 'window', t0: 0.72, t1: 0.88, sill: 0.9 },
    ],
  },
  {
    id: 'ext-north',
    label: 'North wall',
    a: [W, D - I / 2],
    b: [0, D - I / 2],
    thickness: WALL_THICK,
    exterior: true,
    openings: [
      { id: 'win-br2-north', label: 'Bedroom 2 north window', kind: 'window', t0: 0.12, t1: 0.28, sill: 0.9 },
      { id: 'win-br1-n1', label: 'Bedroom 1 north window 1', kind: 'window', t0: 0.48, t1: 0.62, sill: 0.9 },
      { id: 'win-br1-n2', label: 'Bedroom 1 north window 2', kind: 'window', t0: 0.7, t1: 0.84, sill: 0.9 },
    ],
  },
  {
    id: 'ext-west',
    label: 'West wall',
    a: [I / 2, D],
    b: [I / 2, 0],
    thickness: WALL_THICK,
    exterior: true,
    openings: [
      { id: 'win-br1-west', label: 'Bedroom 1 west window', kind: 'window', t0: 0.08, t1: 0.2, sill: 0.9 },
      {
        id: 'win-living-display',
        label: 'Living display window',
        kind: 'window',
        t0: 0.36,
        t1: 0.52,
        sill: 0,
        height: PATIO_OPENING_H,
        style: 'display',
      },
      {
        id: 'door-living-patio',
        label: 'Living patio door (2-frame)',
        kind: 'door',
        t0: 0.58,
        t1: 0.76,
        style: 'french',
      },
    ],
  },
  {
    id: 'part-br1-s',
    label: 'Bedroom 1 / living',
    a: [I, TOP_Z],
    b: [BR1_X, TOP_Z],
    thickness: PARTITION,
    openings: [{ id: 'door-br1', label: 'Bedroom 1 door', kind: 'door', t0: 0.75, t1: 0.95 }],
  },
  {
    id: 'part-br1-br2',
    label: 'Bedroom 1 / bedroom 2',
    a: [BR1_X + PARTITION / 2, TOP_Z],
    b: [BR1_X + PARTITION / 2, NORTH],
    thickness: PARTITION,
  },
  {
    id: 'part-br2-s',
    label: 'Bedroom 2 south',
    a: [BR1_X, TOP_Z],
    b: [W - I, TOP_Z],
    thickness: PARTITION,
    openings: [{ id: 'door-br2', label: 'Bedroom 2 door', kind: 'door', t0: 0.15, t1: 0.35 }],
  },
  {
    id: 'part-office-w',
    label: 'Living / office',
    a: [RX, MID_Z],
    b: [RX, TOP_Z],
    thickness: PARTITION,
    openings: [{ id: 'door-office', label: 'Office door', kind: 'door', t0: 0.2, t1: 0.5 }],
  },
  {
    id: 'part-office-bath',
    label: 'Office / bathroom',
    a: [RX, MID_Z],
    b: [W - I, MID_Z],
    thickness: PARTITION,
  },
  {
    id: 'part-bath-w',
    label: 'Hall / bathroom',
    a: [RX, I],
    b: [RX, MID_Z],
    thickness: PARTITION,
    // Door centered so you face the toilet on the east wall
    openings: [{ id: 'door-bath', label: 'Bathroom door', kind: 'door', t0: 0.4, t1: 0.65 }],
  },
  // West hall wall toward kitchen — solid (no door)
  {
    id: 'part-hall-w',
    label: 'Hall / living (west)',
    a: [HALL_X, I],
    b: [HALL_X, HALL_Z],
    thickness: PARTITION,
  },
  // Glass screen: from bathtub/wardrobe junction across half the bath
  {
    id: 'glass-bath-screen',
    label: 'Bath glass screen',
    a: [RX + 0.95 + 1.55 / 2, I + 0.72],
    b: [RX + 0.95 + 1.55 / 2, I + BATH_D * 0.5],
    thickness: 0.02,
    glass: true,
    screenHeight: 2.0,
  },
]

for (const w of WALLS) {
  if (!w.glass) w.centerline = true
}

/** Built-in apartment walls (legacy starter / migration when payload omits walls). */
export const DEFAULT_WALLS: WallSeg[] = WALLS

export const ALL_OPENINGS: OpeningDef[] = WALLS.flatMap((w) => w.openings ?? [])

export const GLASS_WALLS: WallSeg[] = WALLS.filter((w) => w.glass)

export const DEFAULT_ROOMS = ROOMS

/** Axis-aligned bounds from wall endpoints (padded by half thickness). */
export function deriveBuilding(walls: WallSeg[]): BuildingBounds {
  const solid = walls.filter((w) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 0.01)
  if (!solid.length) return { ...EMPTY_BUILDING }

  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const w of solid) {
    // Footprint AABB: tips are outer edge; thickness only expands inward
    const corners = wallFootprintCorners(w, solid)
    if (corners.length) {
      for (const [x, z] of corners) {
        minX = Math.min(minX, x)
        minZ = Math.min(minZ, z)
        maxX = Math.max(maxX, x)
        maxZ = Math.max(maxZ, z)
      }
    } else {
      minX = Math.min(minX, w.a[0], w.b[0])
      minZ = Math.min(minZ, w.a[1], w.b[1])
      maxX = Math.max(maxX, w.a[0], w.b[0])
      maxZ = Math.max(maxZ, w.a[1], w.b[1])
    }
  }
  const w = Math.max(1, maxX - minX)
  const d = Math.max(1, maxZ - minZ)
  return {
    w,
    d,
    minX,
    minZ,
    centerX: minX + w / 2,
    centerZ: minZ + d / 2,
  }
}

/** Union of two AABB building frames. */
export function unionBuildingBounds(a: BuildingBounds, b: BuildingBounds): BuildingBounds {
  const minX = Math.min(a.minX, b.minX)
  const minZ = Math.min(a.minZ, b.minZ)
  const maxX = Math.max(a.minX + a.w, b.minX + b.w)
  const maxZ = Math.max(a.minZ + a.d, b.minZ + b.d)
  const w = Math.max(1, maxX - minX)
  const d = Math.max(1, maxZ - minZ)
  return {
    minX,
    minZ,
    w,
    d,
    centerX: minX + w / 2,
    centerZ: minZ + d / 2,
  }
}

/**
 * Stable 2D canvas frame for custom plans: always at least EMPTY_BUILDING,
 * expands to fit walls, never shrink-wraps a single segment (avoids zoom jumps).
 */
export function planCanvasBounds(walls: WallSeg[]): BuildingBounds {
  if (!walls.length) return { ...EMPTY_BUILDING }
  return unionBuildingBounds(EMPTY_BUILDING, deriveBuilding(walls))
}

/** Centerline AABB (no thickness padding) — matches drawn wall lengths for axis-aligned plans. */
export function deriveCenterlineBounds(walls: WallSeg[]): BuildingBounds | null {
  const solid = walls.filter(
    (w) => !w.glass && Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 0.01,
  )
  if (!solid.length) return null
  let minX = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxZ = -Infinity
  for (const w of solid) {
    minX = Math.min(minX, w.a[0], w.b[0])
    minZ = Math.min(minZ, w.a[1], w.b[1])
    maxX = Math.max(maxX, w.a[0], w.b[0])
    maxZ = Math.max(maxZ, w.a[1], w.b[1])
  }
  const w = Math.max(0.01, maxX - minX)
  const d = Math.max(0.01, maxZ - minZ)
  return {
    minX,
    minZ,
    w,
    d,
    centerX: minX + w / 2,
    centerZ: minZ + d / 2,
  }
}

/** How a detected custom room is finished / enclosed */
export type RoomKind = 'room' | 'bath' | 'terrace'

export const ROOM_KIND_LABEL: Record<RoomKind, string> = {
  room: 'Room',
  bath: 'Bath',
  terrace: 'Terrace',
}

export function normalizeRoomKind(v: unknown): RoomKind {
  return v === 'bath' || v === 'terrace' ? v : 'room'
}

/** Stable room id from boundary wall set (survives axis re-clustering when new rooms appear). */
export function stableRoomId(wallIds: string[]): string {
  const sorted = [...new Set(wallIds)].sort()
  let h = 2166136261
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    h ^= 0x1f
    h = Math.imul(h, 16777619)
  }
  return `room-${(h >>> 0).toString(36)}`
}

/** Parse legacy coordinate-based room ids: room-{x}_{z}_{w}_{d} */
function parseLegacyRoomId(
  id: string,
): { minX: number; minZ: number; w: number; d: number } | null {
  const m = /^room-(-?\d+\.\d+)_(-?\d+\.\d+)_(-?\d+\.\d+)_(-?\d+\.\d+)$/.exec(id)
  if (!m) return null
  return { minX: Number(m[1]), minZ: Number(m[2]), w: Number(m[3]), d: Number(m[4]) }
}

function rectOverlapArea(
  a: { minX: number; minZ: number; w: number; d: number },
  b: { minX: number; minZ: number; w: number; d: number },
): number {
  const x0 = Math.max(a.minX, b.minX)
  const x1 = Math.min(a.minX + a.w, b.minX + b.w)
  const z0 = Math.max(a.minZ, b.minZ)
  const z1 = Math.min(a.minZ + a.d, b.minZ + b.d)
  return Math.max(0, x1 - x0) * Math.max(0, z1 - z0)
}

/**
 * Keep room names/kinds attached when detection ids change (new walls, axis merge).
 * Matches orphans to live rooms by footprint overlap.
 */
export function reconcileRoomMeta(
  rooms: CustomRoomMeasure[],
  names: Record<string, string>,
  kinds: Record<string, RoomKind>,
  prevRooms: CustomRoomMeasure[] = [],
): { names: Record<string, string>; kinds: Record<string, RoomKind> } {
  const liveIds = new Set(rooms.map((r) => r.id))
  const nextNames: Record<string, string> = {}
  const nextKinds: Record<string, RoomKind> = {}

  for (const r of rooms) {
    const n = names[r.id]?.trim()
    if (n) nextNames[r.id] = n
    const k = normalizeRoomKind(kinds[r.id])
    if (k !== 'room') nextKinds[r.id] = k
  }

  const prevById = new Map(prevRooms.map((r) => [r.id, r]))

  type OrphanGeom = { minX: number; minZ: number; w: number; d: number }
  const orphanGeom = (id: string): OrphanGeom | null => {
    const prev = prevById.get(id)
    if (prev) {
      return {
        minX: prev.span.minX,
        minZ: prev.span.minZ,
        w: prev.span.w,
        d: prev.span.d,
      }
    }
    return parseLegacyRoomId(id)
  }

  type Orphan = OrphanGeom & { name?: string; kind?: RoomKind }
  const orphans = new Map<string, Orphan>()

  for (const [id, name] of Object.entries(names)) {
    if (liveIds.has(id)) continue
    const trimmed = name.trim()
    if (!trimmed) continue
    const geom = orphanGeom(id)
    if (!geom) continue
    orphans.set(id, { ...geom, name: trimmed })
  }
  for (const [id, kindRaw] of Object.entries(kinds)) {
    if (liveIds.has(id)) continue
    const kind = normalizeRoomKind(kindRaw)
    if (kind === 'room') continue
    const geom = orphanGeom(id)
    if (!geom) continue
    const existing = orphans.get(id)
    if (existing) existing.kind = kind
    else orphans.set(id, { ...geom, kind })
  }

  for (const orphan of orphans.values()) {
    const orphanArea = Math.max(1e-6, orphan.w * orphan.d)
    let best: CustomRoomMeasure | null = null
    let bestScore = 0
    for (const r of rooms) {
      const ov = rectOverlapArea(orphan, r.span)
      const union = orphanArea + r.span.w * r.span.d - ov
      const score = union > 1e-6 ? ov / union : 0
      if (score > bestScore) {
        bestScore = score
        best = r
      }
    }
    if (!best || bestScore < 0.12) continue
    if (orphan.name && !nextNames[best.id]) nextNames[best.id] = orphan.name
    if (orphan.kind && orphan.kind !== 'room' && !nextKinds[best.id]) {
      nextKinds[best.id] = orphan.kind
    }
  }

  return { names: nextNames, kinds: nextKinds }
}

export type CustomRoomMeasure = {
  id: string
  /** Inner clear rectangle (face-to-face), if thickness known */
  inner: { minX: number; minZ: number; w: number; d: number; area: number }
  /** Outer face rectangle */
  outer: { minX: number; minZ: number; w: number; d: number; area: number }
  /** Centerline span (exact drawn lengths for axis-aligned loops) */
  span: { minX: number; minZ: number; w: number; d: number }
  labelAt: [number, number]
  avgThickness: number
  wallIds: string[]
}

/** Walls that only bound terrace rooms (not shared with room/bath) → render as fence. */
export function terraceFenceWallIds(
  rooms: CustomRoomMeasure[],
  kinds: Record<string, RoomKind>,
): Set<string> {
  const terrace = new Set<string>()
  const interior = new Set<string>()
  for (const room of rooms) {
    const kind = normalizeRoomKind(kinds[room.id])
    const target = kind === 'terrace' ? terrace : interior
    for (const id of room.wallIds) target.add(id)
  }
  const out = new Set<string>()
  for (const id of terrace) {
    if (!interior.has(id)) out.add(id)
  }
  return out
}

/** Clear-floor polygon for a custom room (inner face-to-face). */
export function customRoomFloorPolygon(room: CustomRoomMeasure): [number, number][] {
  const { minX, minZ, w, d } = room.inner
  return [
    [minX, minZ],
    [minX + w, minZ],
    [minX + w, minZ + d],
    [minX, minZ + d],
  ]
}

function ptKey(x: number, z: number) {
  return `${x.toFixed(3)},${z.toFixed(3)}`
}

/** Merge endpoints within joinTol so near-miss corners still form closed rooms. */
function clusterEndpoints(
  walls: WallSeg[],
  joinTol = 0.12,
): { map: Map<string, [number, number]>; reps: [number, number][] } {
  const raw: [number, number][] = []
  for (const w of walls) {
    raw.push([w.a[0], w.a[1]], [w.b[0], w.b[1]])
  }
  const reps: [number, number][] = []
  const map = new Map<string, [number, number]>()
  for (const p of raw) {
    const hit = reps.find((r) => Math.hypot(r[0] - p[0], r[1] - p[1]) <= joinTol)
    const rep =
      hit ??
      (() => {
        reps.push(p)
        return p
      })()
    map.set(ptKey(p[0], p[1]), rep)
  }
  return { map, reps }
}

type NormSeg = {
  id: string
  a: [number, number]
  b: [number, number]
  thickness: number
  horizontal: boolean
  /** Which side of the axis the body sits on (+1 / -1 in the perpendicular coord); 0 = centered. */
  inward: 1 | -1 | 0
}

/** How far a wall's body intrudes into a rectangle lying on `rectSide` of its axis. */
function segInset(s: NormSeg, rectSide: 1 | -1): number {
  if (s.inward === 0) return s.thickness / 2
  return s.inward === rectSide ? s.thickness : 0
}

/** Area of a wall footprint that overlaps an axis-aligned clear rectangle. */
function segFootprintAreaInRect(
  s: NormSeg,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): number {
  if (s.horizontal) {
    let z0: number
    let z1: number
    if (s.inward === 0) {
      z0 = s.a[1] - s.thickness / 2
      z1 = s.a[1] + s.thickness / 2
    } else if (s.inward === 1) {
      z0 = s.a[1]
      z1 = s.a[1] + s.thickness
    } else {
      z0 = s.a[1] - s.thickness
      z1 = s.a[1]
    }
    const ovZ = overlap1d(z0, z1, minZ, maxZ)
    const ovX = overlap1d(s.a[0], s.b[0], minX, maxX)
    return ovX * ovZ
  }
  let x0: number
  let x1: number
  if (s.inward === 0) {
    x0 = s.a[0] - s.thickness / 2
    x1 = s.a[0] + s.thickness / 2
  } else if (s.inward === 1) {
    x0 = s.a[0]
    x1 = s.a[0] + s.thickness
  } else {
    x0 = s.a[0] - s.thickness
    x1 = s.a[0]
  }
  const ovX = overlap1d(x0, x1, minX, maxX)
  const ovZ = overlap1d(s.a[1], s.b[1], minZ, maxZ)
  return ovX * ovZ
}

function overlap1d(a0: number, a1: number, b0: number, b1: number) {
  const lo = Math.max(Math.min(a0, a1), Math.min(b0, b1))
  const hi = Math.min(Math.max(a0, a1), Math.max(b0, b1))
  return Math.max(0, hi - lo)
}

/**
 * True when colinear wall pieces cover the full axis-aligned side.
 * `rectSide` tells which side of this line the room lies on (+1 = larger coord),
 * so `inset` reports how much wall body actually intrudes into the room.
 */
function sideCovered(
  segs: NormSeg[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  rectSide: 1 | -1,
  tol = 0.14,
): { ok: boolean; thickness: number; inset: number; ids: string[] } {
  const dx = x1 - x0
  const dz = z1 - z0
  const need = Math.hypot(dx, dz)
  if (need < 0.25) return { ok: false, thickness: 0, inset: 0, ids: [] }
  const horizontal = Math.abs(dz) < 1e-6
  let covered = 0
  let thickSum = 0
  let insetSum = 0
  let thickN = 0
  const ids: string[] = []
  for (const s of segs) {
    if (s.horizontal !== horizontal) continue
    // Segment lines are already snapped onto grid axes, so a wall may only cover the
    // side on its own axis. A thickness-scaled tolerance here would let a thick house
    // wall also "cover" a parallel axis a few cm inside it (terrace fence next to it),
    // spawning a phantom room or shifting the real one.
    const lineTol = tol
    const ov = horizontal
      ? Math.abs(s.a[1] - z0) > lineTol
        ? 0
        : overlap1d(s.a[0], s.b[0], x0, x1)
      : Math.abs(s.a[0] - x0) > lineTol
        ? 0
        : overlap1d(s.a[1], s.b[1], z0, z1)
    if (ov > 0.02) {
      covered += ov
      thickSum += s.thickness * ov
      insetSum += segInset(s, rectSide) * ov
      thickN += ov
      ids.push(s.id)
    }
  }
  const avgT = thickN ? thickSum / thickN : DEFAULT_WALL_THICKNESS
  const inset = thickN ? insetSum / thickN : DEFAULT_WALL_THICKNESS
  // Shortfall of ~thickness at each T end is OK (inner-face attach)
  const slack = Math.max(tol, 2 * avgT + 0.06)
  return {
    ok: covered >= need - slack,
    thickness: avgT,
    inset,
    ids,
  }
}

/**
 * Detect axis-aligned rectangular rooms from closed wall loops.
 * - Grid from wall axes only (merged within tol) so inner-face T tips don't spawn phantoms
 * - Coverage segs extend to host axes so clear-span partitions still close rooms
 * - Labels at geometric span center
 */
export function findCustomRectangularRooms(walls: WallSeg[]): CustomRoomMeasure[] {
  const solid = walls.filter(
    (w) => !w.glass && Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 0.02,
  )
  if (solid.length < 4) return []

  const { map: clusters } = clusterEndpoints(solid)
  const snap = (p: [number, number]): [number, number] => {
    const r = clusters.get(ptKey(p[0], p[1]))
    return r ? ([r[0], r[1]] as [number, number]) : p
  }

  // Cluster near-coincident axes; each cluster keeps the value carried by the most
  // wall length (not the running average), so adding a short nearby wall — e.g. a
  // terrace fence — cannot nudge the axes of rooms that already exist.
  const mergeAxes = (vals: { v: number; w: number }[], tol = 0.08): number[] => {
    const sorted = [...vals].sort((a, b) => a.v - b.v)
    const clusters: { v: number; w: number }[][] = []
    for (const item of sorted) {
      const cur = clusters[clusters.length - 1]
      if (!cur || item.v - cur[cur.length - 1].v > tol) clusters.push([item])
      else cur.push(item)
    }
    return clusters.map((c) => {
      let best = c[0]
      for (const item of c) if (item.w > best.w) best = item
      return best.v
    })
  }

  type RawSeg = {
    id: string
    a: [number, number]
    b: [number, number]
    thickness: number
    horizontal: boolean
    inward: 1 | -1 | 0
  }
  const raw: RawSeg[] = []
  const xRaw: { v: number; w: number }[] = []
  const zRaw: { v: number; w: number }[] = []

  for (const w of solid) {
    const a = snap(w.a)
    const b = snap(w.b)
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const horizontal = Math.abs(dz) < 0.05 && Math.abs(dx) > 0.08
    const vertical = Math.abs(dx) < 0.05 && Math.abs(dz) > 0.08
    if (!horizontal && !vertical) continue
    const thick = w.thickness ?? DEFAULT_WALL_THICKNESS
    const aa: [number, number] = horizontal
      ? [a[0], (a[1] + b[1]) / 2]
      : [(a[0] + b[0]) / 2, a[1]]
    const bb: [number, number] = horizontal ? [b[0], aa[1]] : [aa[0], b[1]]
    let inward: 1 | -1 | 0 = 0
    if (!w.centerline) {
      const n = wallInwardNormal(w, solid)
      const comp = horizontal ? n.iz : n.ix
      inward = comp >= 0 ? 1 : -1
    }
    raw.push({ id: w.id, a: aa, b: bb, thickness: thick, horizontal, inward })
    const len = Math.hypot(dx, dz)
    if (horizontal) zRaw.push({ v: aa[1], w: len })
    else xRaw.push({ v: aa[0], w: len })
  }
  if (raw.length < 4) return []

  const xs = mergeAxes(xRaw)
  const zs = mergeAxes(zRaw)
  if (xs.length < 2 || zs.length < 2) return []

  const nearest = (v: number, axes: number[]) => {
    let best = axes[0]
    let bestD = Math.abs(v - best)
    for (const a of axes) {
      const d = Math.abs(v - a)
      if (d < bestD) {
        bestD = d
        best = a
      }
    }
    return { axis: best, dist: bestD }
  }

  // Coverage: snap each end onto nearest perpendicular grid axis when within ~host thickness.
  // A thin partition ending on a thick wall's inner face is a full host-thickness away
  // from that wall's axis, so reach must use the thickest wall, not the partition's own.
  const maxThick = raw.reduce((m, s) => Math.max(m, s.thickness), DEFAULT_WALL_THICKNESS)
  // Prefer the host wall whose BODY actually contains the tip over the merely nearest
  // axis: with a generous reach, a parallel wall a few cm away (terrace fence next to
  // the house wall) would otherwise steal the tip and shift the room onto its axis.
  const bodyHostAxis = (
    p: [number, number],
    hostsHorizontal: boolean,
    tol = 0.06,
  ): number | null => {
    let best: { axis: number; d: number } | null = null
    for (const h of raw) {
      if (h.horizontal !== hostsHorizontal) continue
      const line = hostsHorizontal ? h.a[1] : h.a[0]
      const perp = hostsHorizontal ? p[1] : p[0]
      const along = hostsHorizontal ? p[0] : p[1]
      let lo: number
      let hi: number
      if (h.inward === 0) {
        lo = line - h.thickness / 2
        hi = line + h.thickness / 2
      } else if (h.inward === 1) {
        lo = line
        hi = line + h.thickness
      } else {
        lo = line - h.thickness
        hi = line
      }
      const a0 = Math.min(h.a[hostsHorizontal ? 0 : 1], h.b[hostsHorizontal ? 0 : 1]) - h.thickness
      const a1 = Math.max(h.a[hostsHorizontal ? 0 : 1], h.b[hostsHorizontal ? 0 : 1]) + h.thickness
      const dPerp = perp < lo ? lo - perp : perp > hi ? perp - hi : 0
      const dAlong = along < a0 ? a0 - along : along > a1 ? along - a1 : 0
      const d = Math.hypot(dPerp, dAlong)
      if (d <= tol && (!best || d < best.d)) {
        best = { axis: nearest(line, hostsHorizontal ? zs : xs).axis, d }
      }
    }
    return best ? best.axis : null
  }
  const segs: NormSeg[] = raw.map((s) => {
    const reach = Math.max(0.12, maxThick + 0.12)
    if (s.horizontal) {
      const z = nearest(s.a[1], zs).axis
      let x0 = s.a[0]
      let x1 = s.b[0]
      const h0 = bodyHostAxis(s.a, false)
      const h1 = bodyHostAxis(s.b, false)
      const n0 = nearest(x0, xs)
      const n1 = nearest(x1, xs)
      if (h0 !== null) x0 = h0
      else if (n0.dist <= reach) x0 = n0.axis
      if (h1 !== null) x1 = h1
      else if (n1.dist <= reach) x1 = n1.axis
      return {
        id: s.id,
        a: [x0, z] as [number, number],
        b: [x1, z] as [number, number],
        thickness: s.thickness,
        horizontal: true,
        inward: s.inward,
      }
    }
    const x = nearest(s.a[0], xs).axis
    let z0 = s.a[1]
    let z1 = s.b[1]
    const h0 = bodyHostAxis(s.a, true)
    const h1 = bodyHostAxis(s.b, true)
    const n0 = nearest(z0, zs)
    const n1 = nearest(z1, zs)
    if (h0 !== null) z0 = h0
    else if (n0.dist <= reach) z0 = n0.axis
    if (h1 !== null) z1 = h1
    else if (n1.dist <= reach) z1 = n1.axis
    return {
      id: s.id,
      a: [x, z0] as [number, number],
      b: [x, z1] as [number, number],
      thickness: s.thickness,
      horizontal: false,
      inward: s.inward,
    }
  })

  const rooms: CustomRoomMeasure[] = []
  // Same wall set can satisfy several nearby rectangles (a thick wall matches a grid
  // axis a few cm off its line). Keep the one whose sides sit closest to the actual
  // wall lines instead of the first one enumerated.
  const seen = new Map<string, { idx: number; misfit: number }>()
  const segById = new Map(segs.map((s) => [s.id, s]))
  const sideMisfit = (ids: string[], axis: number, horizontal: boolean) => {
    if (!ids.length) return 0
    let sum = 0
    for (const id of ids) {
      const s = segById.get(id)
      if (s) sum += Math.abs((horizontal ? s.a[1] : s.a[0]) - axis)
    }
    return sum / ids.length
  }

  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      for (let k = 0; k < zs.length; k++) {
        for (let l = k + 1; l < zs.length; l++) {
          const x0 = xs[i]
          const x1 = xs[j]
          const z0 = zs[k]
          const z1 = zs[l]
          const spanW = x1 - x0
          const spanD = z1 - z0
          if (spanW < 0.3 || spanD < 0.3) continue

          // Room lies at +z of south, -z of north, +x of west, -x of east
          const south = sideCovered(segs, x0, z0, x1, z0, 1)
          const north = sideCovered(segs, x0, z1, x1, z1, -1)
          const west = sideCovered(segs, x0, z0, x0, z1, 1)
          const east = sideCovered(segs, x1, z0, x1, z1, -1)
          if (!south.ok || !north.ok || !west.ok || !east.ok) continue

          // Atomic: reject only when an internal wall FULLY divides this rectangle.
          // A stub / incomplete partition must not unregister the room — it stays one
          // room and we subtract the stub footprint from floor area below.
          // Walls that form this rectangle's own boundary are never dividers, even
          // when their thickness makes them match a grid axis just inside the room
          // (e.g. a terrace fence running 20 cm off a thick house wall).
          const boundaryIds = new Set([...south.ids, ...north.ids, ...west.ids, ...east.ids])
          let atomic = true
          const lineTol = 0.14
          for (let m = i + 1; m < j; m++) {
            const xv = xs[m]
            const need = z1 - z0
            for (const s of segs) {
              if (s.horizontal || boundaryIds.has(s.id)) continue
              if (Math.abs(s.a[0] - xv) > Math.max(lineTol, s.thickness * 0.6)) continue
              const ov = overlap1d(s.a[1], s.b[1], z0, z1)
              const slack = Math.max(0.14, 2 * s.thickness + 0.08)
              if (ov >= need - slack) {
                atomic = false
                break
              }
            }
            if (!atomic) break
          }
          if (!atomic) continue
          for (let m = k + 1; m < l; m++) {
            const zv = zs[m]
            const need = x1 - x0
            for (const s of segs) {
              if (!s.horizontal || boundaryIds.has(s.id)) continue
              if (Math.abs(s.a[1] - zv) > Math.max(lineTol, s.thickness * 0.6)) continue
              const ov = overlap1d(s.a[0], s.b[0], x0, x1)
              const slack = Math.max(0.14, 2 * s.thickness + 0.08)
              if (ov >= need - slack) {
                atomic = false
                break
              }
            }
            if (!atomic) break
          }
          if (!atomic) continue

          const wallIds = [...boundaryIds]
          const boundary = boundaryIds
          const avgT =
            (south.thickness + north.thickness + west.thickness + east.thickness) / 4

          const id = stableRoomId(wallIds)
          const misfit =
            sideMisfit(south.ids, z0, true) +
            sideMisfit(north.ids, z1, true) +
            sideMisfit(west.ids, x0, false) +
            sideMisfit(east.ids, x1, false)
          const prev = seen.get(id)
          if (prev && prev.misfit <= misfit + 1e-6) continue

          // Clear span: subtract only the wall body that actually sits inside this room
          const innerW = Math.max(0.05, spanW - west.inset - east.inset)
          const innerD = Math.max(0.05, spanD - south.inset - north.inset)
          const innerMinX = x0 + west.inset
          const innerMinZ = z0 + south.inset
          const cx = innerMinX + innerW / 2
          const cz = innerMinZ + innerD / 2

          // Incomplete partitions inside the clear rectangle: keep the room, reduce area
          let stubArea = 0
          for (const s of segs) {
            if (boundary.has(s.id)) continue
            stubArea += segFootprintAreaInRect(
              s,
              innerMinX,
              innerMinZ,
              innerMinX + innerW,
              innerMinZ + innerD,
            )
          }
          const clearArea = Math.max(0.01, innerW * innerD - stubArea)

          const room: CustomRoomMeasure = {
            id,
            span: { minX: x0, minZ: z0, w: spanW, d: spanD },
            inner: {
              minX: innerMinX,
              minZ: innerMinZ,
              w: innerW,
              d: innerD,
              area: clearArea,
            },
            outer: {
              minX: x0,
              minZ: z0,
              w: spanW,
              d: spanD,
              area: spanW * spanD,
            },
            labelAt: [cx, cz],
            avgThickness: avgT,
            wallIds,
          }
          if (prev) rooms[prev.idx] = room
          else rooms.push(room)
          seen.set(id, { idx: prev ? prev.idx : rooms.length - 1, misfit })
        }
      }
    }
  }

  return rooms
}


/** Segment intersection in XZ (inclusive). Returns null if parallel / no overlap. */
export function segmentIntersection(
  a0: [number, number],
  a1: [number, number],
  b0: [number, number],
  b1: [number, number],
): { x: number; z: number; tA: number; tB: number } | null {
  const ax = a1[0] - a0[0]
  const az = a1[1] - a0[1]
  const bx = b1[0] - b0[0]
  const bz = b1[1] - b0[1]
  const den = ax * bz - az * bx
  if (Math.abs(den) < 1e-9) return null
  const dx = b0[0] - a0[0]
  const dz = b0[1] - a0[1]
  const tA = (dx * bz - dz * bx) / den
  const tB = (dx * az - dz * ax) / den
  if (tA < -1e-4 || tA > 1 + 1e-4 || tB < -1e-4 || tB > 1 + 1e-4) return null
  return {
    x: a0[0] + tA * ax,
    z: a0[1] + tA * az,
    tA: Math.min(1, Math.max(0, tA)),
    tB: Math.min(1, Math.max(0, tB)),
  }
}

/** Live distances along existing walls crossed (or started on) by a draft segment. */
export function draftWallReferenceMeasures(
  start: [number, number],
  end: [number, number],
  walls: WallSeg[],
): {
  wallId: string
  hit: [number, number]
  alongA: number
  alongB: number
  wallLen: number
}[] {
  const out: {
    wallId: string
    hit: [number, number]
    alongA: number
    alongB: number
    wallLen: number
  }[] = []
  const draftLen = Math.hypot(end[0] - start[0], end[1] - start[1])
  if (draftLen < 0.02) return out

  for (const w of walls) {
    if (w.glass) continue
    const wallLen = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
    if (wallLen < 0.05) continue

    // Crossing interior of an existing wall
    const hit = segmentIntersection(start, end, w.a, w.b)
    if (hit && hit.tA > 0.02 && hit.tA < 0.98 && hit.tB > 0.02 && hit.tB < 0.98) {
      const alongA = hit.tB * wallLen
      out.push({
        wallId: w.id,
        hit: [hit.x, hit.z],
        alongA,
        alongB: wallLen - alongA,
        wallLen,
      })
      continue
    }

    // Draft starts on this wall — measure along wall to current end projection
    const nearStart =
      Math.hypot(start[0] - w.a[0], start[1] - w.a[1]) < 0.2 ||
      Math.hypot(start[0] - w.b[0], start[1] - w.b[1]) < 0.2 ||
      (() => {
        const t =
          ((start[0] - w.a[0]) * (w.b[0] - w.a[0]) +
            (start[1] - w.a[1]) * (w.b[1] - w.a[1])) /
          (wallLen * wallLen || 1)
        if (t < 0.02 || t > 0.98) return false
        const px = w.a[0] + t * (w.b[0] - w.a[0])
        const pz = w.a[1] + t * (w.b[1] - w.a[1])
        return Math.hypot(start[0] - px, start[1] - pz) < 0.12
      })()

    if (nearStart) {
      const t =
        ((start[0] - w.a[0]) * (w.b[0] - w.a[0]) +
          (start[1] - w.a[1]) * (w.b[1] - w.a[1])) /
        (wallLen * wallLen || 1)
      const tc = Math.min(1, Math.max(0, t))
      const alongA = tc * wallLen
      out.push({
        wallId: w.id,
        hit: [start[0], start[1]],
        alongA,
        alongB: wallLen - alongA,
        wallLen,
      })
    }
  }
  return out
}

/** Closest projection of a point onto a solid wall centerline (for hover measures). */
export function nearestWallProjection(
  x: number,
  z: number,
  walls: WallSeg[],
  maxDist = 0.45,
): {
  wallId: string
  point: [number, number]
  t: number
  alongA: number
  alongB: number
  wallLen: number
  dist: number
} | null {
  let best: {
    wallId: string
    point: [number, number]
    t: number
    alongA: number
    alongB: number
    wallLen: number
    dist: number
  } | null = null

  for (const w of walls) {
    if (w.glass) continue
    const [ax, az] = w.a
    const [bx, bz] = w.b
    const dx = bx - ax
    const dz = bz - az
    const wallLen = Math.hypot(dx, dz)
    if (wallLen < 0.05) continue
    let t = ((x - ax) * dx + (z - az) * dz) / (wallLen * wallLen)
    t = Math.min(1, Math.max(0, t))
    const px = ax + t * dx
    const pz = az + t * dz
    const dist = Math.hypot(x - px, z - pz)
    const hitTol = Math.max(maxDist, (w.thickness ?? DEFAULT_WALL_THICKNESS) * 0.75 + 0.08)
    if (dist > hitTol) continue
    if (!best || dist < best.dist) {
      const alongA = t * wallLen
      best = {
        wallId: w.id,
        point: [px, pz],
        t,
        alongA,
        alongB: wallLen - alongA,
        wallLen,
        dist,
      }
    }
  }
  return best
}

export function wallAxes(wall: WallSeg) {
  const dx = wall.b[0] - wall.a[0]
  const dz = wall.b[1] - wall.a[1]
  const len = Math.hypot(dx, dz) || 1
  const half = (wall.thickness ?? DEFAULT_WALL_THICKNESS) / 2
  return {
    ux: dx / len,
    uz: dz / len,
    nx: -dz / len,
    nz: dx / len,
    len,
    half,
  }
}

/** Point on the drawn outer edge a→b at parameter t (0–1). */
export function wallEdgePointAt(wall: WallSeg, t: number): [number, number] {
  const tc = Math.min(1, Math.max(0, t))
  return [
    wall.a[0] + (wall.b[0] - wall.a[0]) * tc,
    wall.a[1] + (wall.b[1] - wall.a[1]) * tc,
  ]
}

/**
 * Point on a wall face at parameter t along a→b.
 * Outer-edge: outer = edge, inner = edge + thickness inward.
 * Centerline: faces at ±half thickness toward the query side.
 */
export function wallFacePointAt(
  wall: WallSeg,
  t: number,
  towardX: number,
  towardZ: number,
  allWalls?: WallSeg[],
): [number, number] {
  const edge = wallEdgePointAt(wall, t)
  if (wall.centerline) {
    const { nx, nz, half } = wallAxes(wall)
    const sideDot = (towardX - edge[0]) * nx + (towardZ - edge[1]) * nz
    const side = sideDot >= 0 ? 1 : -1
    return [edge[0] + nx * half * side, edge[1] + nz * half * side]
  }
  const walls = allWalls && allWalls.length ? allWalls : [wall]
  const { ix, iz } = wallInwardNormal(wall, walls)
  const thick = wall.thickness ?? DEFAULT_WALL_THICKNESS
  const sideDot = (towardX - edge[0]) * ix + (towardZ - edge[1]) * iz
  if (sideDot > 0) {
    return [edge[0] + ix * thick, edge[1] + iz * thick]
  }
  return edge
}

/**
 * Join point at a wall endpoint. Outer-edge model: tips are already outer corners.
 */
export function wallCornerJoinPoint(
  wall: WallSeg,
  handle: 'a' | 'b',
  _towardX: number,
  _towardZ: number,
): [number, number] {
  const end = handle === 'a' ? wall.a : wall.b
  return [end[0], end[1]]
}

function endpointsNear(
  p: [number, number],
  q: [number, number],
  tol = 0.12,
) {
  return Math.hypot(p[0] - q[0], p[1] - q[1]) <= tol
}

/** True if another solid wall shares this endpoint (corner / T tip). */
export function wallEndIsJoined(
  wall: WallSeg,
  end: 'a' | 'b',
  allWalls: WallSeg[],
  joinTol = 0.12,
): boolean {
  const p = end === 'a' ? wall.a : wall.b
  return allWalls.some(
    (w) =>
      w.id !== wall.id &&
      !w.glass &&
      (endpointsNear(w.a, p, joinTol) || endpointsNear(w.b, p, joinTol)),
  )
}

/**
 * Unit inward normal for a wall (toward the cluster of other walls / room interior).
 * Drawn a→b is the OUTER edge; thickness extrudes along this normal.
 */
export function wallInwardNormal(
  wall: WallSeg,
  allWalls: WallSeg[],
): { ix: number; iz: number } {
  const { nx, nz, len } = wallAxes(wall)
  if (len < 1e-6) return { ix: 0, iz: 0 }
  if (wall.side === 1 || wall.side === -1) {
    return { ix: nx * wall.side, iz: nz * wall.side }
  }
  const midX = (wall.a[0] + wall.b[0]) / 2
  const midZ = (wall.a[1] + wall.b[1]) / 2
  let cx = 0
  let cz = 0
  let n = 0
  for (const w of allWalls) {
    if (w.glass) continue
    cx += w.a[0] + w.b[0]
    cz += w.a[1] + w.b[1]
    n += 2
  }
  if (n < 2) return { ix: nx, iz: nz }
  cx /= n
  cz /= n
  const side = (cx - midX) * nx + (cz - midZ) * nz
  if (Math.abs(side) < 1e-6) return { ix: nx, iz: nz }
  return side > 0 ? { ix: nx, iz: nz } : { ix: -nx, iz: -nz }
}

/** Effective thickness side (+1 = body on +n of a→b), explicit or inferred. */
export function wallEffectiveSide(wall: WallSeg, allWalls: WallSeg[]): 1 | -1 {
  if (wall.side === 1 || wall.side === -1) return wall.side
  const { nx, nz } = wallAxes(wall)
  const { ix, iz } = wallInwardNormal(wall, allWalls)
  return ix * nx + iz * nz >= 0 ? 1 : -1
}

/**
 * Side a new wall should use to continue a neighbour's body across a shared tip
 * (closed 90° corner, no notch). `point` is the new wall's start.
 * Returns null when the point is not a tip of any wall.
 */
export function continuationSide(
  point: [number, number],
  walls: WallSeg[],
  tol = 0.03,
): 1 | -1 | null {
  for (const w of walls) {
    if (w.glass) continue
    const eff = wallEffectiveSide(w, walls)
    if (Math.hypot(w.b[0] - point[0], w.b[1] - point[1]) <= tol) return eff
    if (Math.hypot(w.a[0] - point[0], w.a[1] - point[1]) <= tol) return eff === 1 ? -1 : 1
  }
  return null
}

/**
 * If `seed` closes a simple loop (every tip shared by exactly two loop walls),
 * return the thickness side each loop wall needs so all bodies face the loop's interior.
 */
export function loopInwardSides(
  seed: WallSeg,
  walls: WallSeg[],
  joinTol = 0.12,
): Map<string, 1 | -1> | null {
  const solid = walls.filter((w) => !w.glass)
  const { map } = clusterEndpoints(solid, joinTol)
  const key = (p: [number, number]) => {
    const r = map.get(ptKey(p[0], p[1]))
    return r ? ptKey(r[0], r[1]) : ptKey(p[0], p[1])
  }
  const startKey = key(seed.a)
  const loop: { wall: WallSeg; from: [number, number]; to: [number, number] }[] = [
    { wall: seed, from: seed.a, to: seed.b },
  ]
  let curKey = key(seed.b)
  let cur = seed
  const used = new Set<string>([seed.id])
  for (let guard = 0; guard < solid.length + 1 && curKey !== startKey; guard++) {
    const next = solid.filter(
      (w) => w.id !== cur.id && !used.has(w.id) && (key(w.a) === curKey || key(w.b) === curKey),
    )
    if (next.length !== 1) return null
    const w = next[0]
    const forward = key(w.a) === curKey
    loop.push({ wall: w, from: forward ? w.a : w.b, to: forward ? w.b : w.a })
    used.add(w.id)
    cur = w
    curKey = key(forward ? w.b : w.a)
  }
  if (curKey !== startKey || loop.length < 3) return null
  // Shoelace in (x, z): positive => interior on the left of travel: (-dz, dx)
  let area2 = 0
  for (const e of loop) area2 += e.from[0] * e.to[1] - e.to[0] * e.from[1]
  if (Math.abs(area2) < 1e-6) return null
  const out = new Map<string, 1 | -1>()
  for (const e of loop) {
    const dx = e.to[0] - e.from[0]
    const dz = e.to[1] - e.from[1]
    const inX = area2 > 0 ? -dz : dz
    const inZ = area2 > 0 ? dx : -dx
    const { nx, nz } = wallAxes(e.wall)
    out.set(e.wall.id, inX * nx + inZ * nz >= 0 ? 1 : -1)
  }
  return out
}

type OuterCornerTip = {
  wall: WallSeg
  handle: 'a' | 'b'
  p: [number, number]
  /** Unit direction from tip toward the wall's other end. */
  along: [number, number]
  inward: { ix: number; iz: number }
}

function outerCornerTips(walls: WallSeg[], allWalls: WallSeg[]): OuterCornerTip[] {
  const solid = walls.filter(
    (w) => !w.glass && !w.centerline && Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) > 1e-3,
  )
  const tips: OuterCornerTip[] = []
  for (const w of solid) {
    const { ux, uz } = wallAxes(w)
    const inward = wallInwardNormal(w, allWalls)
    tips.push({
      wall: w,
      handle: 'a',
      p: [w.a[0], w.a[1]],
      along: [ux, uz],
      inward,
    })
    tips.push({
      wall: w,
      handle: 'b',
      p: [w.b[0], w.b[1]],
      along: [-ux, -uz],
      inward,
    })
  }
  return tips
}

/** True when two tips share a point and both bodies lie outside the turn (notch case). */
function isOuterCornerPair(A: OuterCornerTip, B: OuterCornerTip, tol: number): boolean {
  if (A.wall.id === B.wall.id) return false
  if (Math.hypot(A.p[0] - B.p[0], A.p[1] - B.p[1]) > tol) return false
  const cross = A.inward.ix * B.inward.iz - A.inward.iz * B.inward.ix
  if (Math.abs(cross) < 0.5) return false
  // Covered already if one body extends along the other's length
  if (B.inward.ix * A.along[0] + B.inward.iz * A.along[1] > 0.3) return false
  if (A.inward.ix * B.along[0] + A.inward.iz * B.along[1] > 0.3) return false
  return true
}

/**
 * Corner fills for shared tips where both wall bodies lie OUTSIDE the turn
 * (drawn lines meet at the inner corner). Without these the outer 90° corner
 * has a t×t notch. Bodies inside the turn already overlap, so nothing is emitted.
 *
 * The fill extends each wall's outer face by the other wall's thickness, so callers
 * that commit a new wall should run {@link absorbOuterCornerIntoLength} first so the
 * drawn length already includes that corner.
 */
export function wallCornerFills(
  walls: WallSeg[],
  tol = 0.05,
): { corners: [number, number][]; wallIds: [string, string]; exterior: boolean }[] {
  const tips = outerCornerTips(walls, walls)
  const out: { corners: [number, number][]; wallIds: [string, string]; exterior: boolean }[] = []
  for (let i = 0; i < tips.length; i++) {
    for (let j = i + 1; j < tips.length; j++) {
      const A = tips[i]
      const B = tips[j]
      if (!isOuterCornerPair(A, B, tol)) continue
      const tA = A.wall.thickness ?? DEFAULT_WALL_THICKNESS
      const tB = B.wall.thickness ?? DEFAULT_WALL_THICKNESS
      const [px, pz] = A.p
      const { ix: aix, iz: aiz } = A.inward
      const { ix: bix, iz: biz } = B.inward
      out.push({
        corners: [
          [px, pz],
          [px + aix * tA, pz + aiz * tA],
          [px + aix * tA + bix * tB, pz + aiz * tA + biz * tB],
          [px + bix * tB, pz + biz * tB],
        ],
        wallIds: [A.wall.id, B.wall.id],
        exterior: !!(A.wall.exterior || B.wall.exterior),
      })
    }
  }
  return out
}

/**
 * When `wall` forms an outer 90° corner with a neighbour, the corner fill would
 * otherwise ADD this wall's thickness beyond the neighbour's drawn tip. Pull the
 * shared tip back along the neighbour so face + corner fill = the length that was
 * drawn (outer tip stays where the user clicked). This wall is translated so its
 * own drawn length is unchanged.
 */
export function absorbOuterCornerIntoLength(
  wall: WallSeg,
  allWalls: WallSeg[],
  tol = 0.05,
  /** Neighbours that must not be retracted (already bound a registered room). */
  lockedIds?: Set<string>,
): {
  wall: WallSeg
  neighbourUpdates: { id: string; a: [number, number]; b: [number, number] }[]
} {
  let next: WallSeg = {
    ...wall,
    a: [wall.a[0], wall.a[1]],
    b: [wall.b[0], wall.b[1]],
  }
  const neighbourUpdates: { id: string; a: [number, number]; b: [number, number] }[] = []
  const others = allWalls.filter((w) => w.id !== wall.id)

  const neighbourState = (id: string, fallback: WallSeg) => {
    const upd = neighbourUpdates.find((u) => u.id === id)
    return upd ? { ...fallback, a: upd.a, b: upd.b } : fallback
  }

  const absorbAt = (handle: 'a' | 'b') => {
    const tip: [number, number] = handle === 'a' ? [next.a[0], next.a[1]] : [next.b[0], next.b[1]]
    const scene = [...others.map((w) => neighbourState(w.id, w)), next]
    const tips = outerCornerTips(scene, scene)
    const mine = tips.find((t) => t.wall.id === next.id && t.handle === handle)
    if (!mine) return
    const other = tips.find((t) => isOuterCornerPair(mine, t, tol))
    if (!other) return
    // Never move a wall that already defines an existing room
    if (lockedIds?.has(other.wall.id)) return

    const tMine = next.thickness ?? DEFAULT_WALL_THICKNESS
    // Retract neighbour along itself by this wall's thickness; shared tip moves with it.
    const newTip: [number, number] = [
      tip[0] + other.along[0] * tMine,
      tip[1] + other.along[1] * tMine,
    ]
    const dx = newTip[0] - tip[0]
    const dz = newTip[1] - tip[1]
    next = {
      ...next,
      a: [next.a[0] + dx, next.a[1] + dz],
      b: [next.b[0] + dx, next.b[1] + dz],
    }

    const base = neighbourState(other.wall.id, other.wall)
    const na: [number, number] = other.handle === 'a' ? newTip : [base.a[0], base.a[1]]
    const nb: [number, number] = other.handle === 'b' ? newTip : [base.b[0], base.b[1]]
    const idx = neighbourUpdates.findIndex((u) => u.id === other.wall.id)
    if (idx >= 0) neighbourUpdates[idx] = { id: other.wall.id, a: na, b: nb }
    else neighbourUpdates.push({ id: other.wall.id, a: na, b: nb })
  }

  absorbAt('a')
  absorbAt('b')
  return { wall: next, neighbourUpdates }
}

/** Extra outer-face length contributed by outer-corner fills at each tip. */
export function wallCornerLengthExtensions(
  wall: WallSeg,
  allWalls: WallSeg[],
  tol = 0.05,
): { extA: number; extB: number } {
  if (wall.glass || wall.centerline) return { extA: 0, extB: 0 }
  const tips = outerCornerTips(allWalls, allWalls)
  let extA = 0
  let extB = 0
  for (const mine of tips) {
    if (mine.wall.id !== wall.id) continue
    for (const other of tips) {
      if (!isOuterCornerPair(mine, other, tol)) continue
      const add = other.wall.thickness ?? DEFAULT_WALL_THICKNESS
      if (mine.handle === 'a') extA = Math.max(extA, add)
      else extB = Math.max(extB, add)
    }
  }
  return { extA, extB }
}

/**
 * Wall footprint polygon in plan.
 * Outer-edge model (default): a→b is outer face, thickness fully inward.
 * Centerline model (legacy): a→b is center, thickness ±half both sides.
 */
export function wallFootprintCorners(
  wall: WallSeg,
  allWalls: WallSeg[],
  _opts?: { forceJoinA?: boolean; forceJoinB?: boolean; joinTol?: number },
): [number, number][] {
  const { nx, nz, len, half } = wallAxes(wall)
  if (len < 1e-6) return []
  const t = wall.thickness ?? DEFAULT_WALL_THICKNESS
  const [ax, az] = wall.a
  const [bx, bz] = wall.b
  if (wall.centerline) {
    return [
      [ax + nx * half, az + nz * half],
      [bx + nx * half, bz + nz * half],
      [bx - nx * half, bz - nz * half],
      [ax - nx * half, az - nz * half],
    ]
  }
  const { ix, iz } = wallInwardNormal(wall, allWalls)
  return [
    [ax, az],
    [bx, bz],
    [bx + ix * t, bz + iz * t],
    [ax + ix * t, az + iz * t],
  ]
}

/** Outer-edge length including outer-corner fills at the tips. */
export function wallEdgeLength(wall: WallSeg, allWalls?: WallSeg[]): number {
  const face = wallAxes(wall).len
  if (!allWalls?.length) return face
  const { extA, extB } = wallCornerLengthExtensions(wall, allWalls)
  return face + extA + extB
}

/** @deprecated kept for callers; edge length equals centerline for outer-edge model. */
export function wallJoinExtensions(
  wall: WallSeg,
  _allWalls: WallSeg[],
  _opts?: { forceJoinA?: boolean; forceJoinB?: boolean; joinTol?: number },
): { extA: number; extB: number; half: number; centerLen: number } {
  const { half, len } = wallAxes(wall)
  return { extA: 0, extB: 0, half, centerLen: len }
}

export function centerlineLengthFromEdge(
  edgeLen: number,
  _thickness: number,
  _joinA: boolean,
  _joinB: boolean,
): number {
  return Math.max(0.05, edgeLen)
}

export function draftEdgeLength(
  start: [number, number],
  end: [number, number],
  _thickness?: number,
  _startJoined?: boolean,
  _endJoined?: boolean,
): number {
  return Math.hypot(end[0] - start[0], end[1] - start[1])
}

const MIN_WALL_LEN_SLIDE = 0.15

export type SlideDependent = {
  id: string
  handle: 'a' | 'b'
  /** Parameter along the sliding wall at drag start (0–1). */
  t: number
  startA: [number, number]
  startB: [number, number]
  /** True when the dependent runs parallel to the sliding wall (translate with it). */
  parallel: boolean
}

/** Axis-aligned interior partition: both tips sit on other walls, and at least one is a mid-span / face join (not only outer corners). */
export function isInteriorPartition(wall: WallSeg, allWalls: WallSeg[]): boolean {
  if (wall.glass) return false
  const dx = wall.b[0] - wall.a[0]
  const dz = wall.b[1] - wall.a[1]
  const horizontal = Math.abs(dz) < 0.08 && Math.abs(dx) > 0.15
  const vertical = Math.abs(dx) < 0.08 && Math.abs(dz) > 0.15
  if (!horizontal && !vertical) return false
  const others = allWalls.filter((w) => w.id !== wall.id && !w.glass)
  if (others.length < 2) return false
  // Tips sit on host faces; for outer-edge hosts that is a full host thickness
  // off the drawn edge — reach must cover the thickest neighbour.
  const tipHost = (p: [number, number]) => {
    let best: { t: number; dist: number } | null = null
    for (const w of others) {
      const reach = Math.max(0.22, (w.thickness ?? DEFAULT_WALL_THICKNESS) + 0.12)
      const hit = nearestWallProjection(p[0], p[1], [w], reach)
      if (!hit) continue
      if (!best || hit.dist < best.dist) best = { t: hit.t, dist: hit.dist }
    }
    return best
  }
  const ha = tipHost(wall.a)
  const hb = tipHost(wall.b)
  if (!ha || !hb) return false
  // Outer shell corners sit at t≈0/1 on neighbours; partitions land mid-face.
  const mid = (t: number) => t > 0.06 && t < 0.94
  return mid(ha.t) || mid(hb.t)
}

/**
 * Walls that meet `wall` at a tip (T-junction / end-on-face / shared corner).
 * Captured at drag start so mid-drag updates stay stable.
 */
export function findSlideDependents(wall: WallSeg, allWalls: WallSeg[]): SlideDependent[] {
  const dx = wall.b[0] - wall.a[0]
  const dz = wall.b[1] - wall.a[1]
  const vertical = Math.abs(dx) < 0.08 && Math.abs(dz) > 0.15
  const horizontal = Math.abs(dz) < 0.08 && Math.abs(dx) > 0.15
  if (!vertical && !horizontal) return []

  const thick = wall.thickness ?? DEFAULT_WALL_THICKNESS
  const out: SlideDependent[] = []

  for (const u of allWalls) {
    if (u.id === wall.id || u.glass) continue
    const udx = u.b[0] - u.a[0]
    const udz = u.b[1] - u.a[1]
    const parallel = vertical ? Math.abs(udx) < 0.08 : Math.abs(udz) < 0.08
    // Tip may sit on this wall's inner face → up to `thick` off the drawn edge
    const reach = Math.max(0.22, thick + 0.12)

    for (const handle of ['a', 'b'] as const) {
      const tip = handle === 'a' ? u.a : u.b
      const hit = nearestWallProjection(tip[0], tip[1], [wall], reach)
      if (!hit || hit.wallId !== wall.id) continue
      // Prefer the nearer tip when both land on the host
      const otherTip = handle === 'a' ? u.b : u.a
      const otherHit = nearestWallProjection(otherTip[0], otherTip[1], [wall], reach)
      if (otherHit && otherHit.dist + 1e-6 < hit.dist) continue

      out.push({
        id: u.id,
        handle,
        t: Math.min(1, Math.max(0, hit.t)),
        startA: [u.a[0], u.a[1]],
        startB: [u.b[0], u.b[1]],
        parallel,
      })
      break // one attachment per dependent wall
    }
  }
  return out
}

/**
 * Slide an axis-aligned interior wall along its normal (vertical → X, horizontal → Z)
 * to resize the rooms on either side. Ends stay on their host faces. Connected
 * shorter walls/partitions are updated so they stay attached (resized or translated).
 */
export function slideInteriorWall(
  wall: WallSeg,
  worldX: number,
  worldZ: number,
  originX: number,
  originZ: number,
  startA: [number, number],
  startB: [number, number],
  allWalls: WallSeg[],
  dependents: SlideDependent[] = [],
): {
  a: [number, number]
  b: [number, number]
  axis: 'x' | 'z'
  delta: number
  guides: { axis: 'x' | 'z'; at: number }[]
  dependentUpdates: { id: string; a: [number, number]; b: [number, number] }[]
} | null {
  const dx0 = startB[0] - startA[0]
  const dz0 = startB[1] - startA[1]
  const horizontal = Math.abs(dz0) < 0.08 && Math.abs(dx0) > 0.15
  const vertical = Math.abs(dx0) < 0.08 && Math.abs(dz0) > 0.15
  if (!horizontal && !vertical) return null

  const others = allWalls.filter((w) => w.id !== wall.id && !w.glass)
  const guides: { axis: 'x' | 'z'; at: number }[] = []
  const SNAP = 0.1

  let a2: [number, number]
  let b2: [number, number]
  let axis: 'x' | 'z'
  let delta: number

  if (vertical) {
    let x = startA[0] + (worldX - originX)
    let best = SNAP
    let snapAt: number | null = null
    for (const w of others) {
      const wdx = w.b[0] - w.a[0]
      const wdz = w.b[1] - w.a[1]
      if (Math.abs(wdx) > 0.08 || Math.abs(wdz) < 0.08) continue
      const wx = (w.a[0] + w.b[0]) / 2
      const thick = w.thickness ?? DEFAULT_WALL_THICKNESS
      for (const cand of [wx, wx + thick, wx - thick]) {
        const d = Math.abs(x - cand)
        if (d < best) {
          best = d
          snapAt = cand
        }
      }
    }
    if (snapAt != null) {
      x = snapAt
      guides.push({ axis: 'x', at: x })
    }

    const reattach = (start: [number, number]): [number, number] => {
      let host: ReturnType<typeof nearestWallProjection> = null
      for (const w of others) {
        const reach = Math.max(0.35, (w.thickness ?? DEFAULT_WALL_THICKNESS) + 0.12)
        const hit = nearestWallProjection(start[0], start[1], [w], reach)
        if (hit && (!host || hit.dist < host.dist)) host = hit
      }
      if (!host) return [x, start[1]]
      const hw = others.find((w) => w.id === host!.wallId)
      if (!hw) return [x, start[1]]
      const hdz = hw.b[1] - hw.a[1]
      if (Math.abs(hdz) > 0.08) return [x, start[1]]
      const face = wallFacePointAt(hw, host.t, x, start[1], allWalls)
      return [x, face[1]]
    }
    const a = reattach(startA)
    const b = reattach(startB)
    a2 = [x, a[1]]
    b2 = [x, b[1]]
    if (Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) < MIN_WALL_LEN_SLIDE) return null
    axis = 'x'
    delta = x - startA[0]
  } else {
    let z = startA[1] + (worldZ - originZ)
    let best = SNAP
    let snapAt: number | null = null
    for (const w of others) {
      const wdx = w.b[0] - w.a[0]
      const wdz = w.b[1] - w.a[1]
      if (Math.abs(wdz) > 0.08 || Math.abs(wdx) < 0.08) continue
      const wz = (w.a[1] + w.b[1]) / 2
      const thick = w.thickness ?? DEFAULT_WALL_THICKNESS
      for (const cand of [wz, wz + thick, wz - thick]) {
        const d = Math.abs(z - cand)
        if (d < best) {
          best = d
          snapAt = cand
        }
      }
    }
    if (snapAt != null) {
      z = snapAt
      guides.push({ axis: 'z', at: z })
    }

    const reattach = (start: [number, number]): [number, number] => {
      let host: ReturnType<typeof nearestWallProjection> = null
      for (const w of others) {
        const reach = Math.max(0.35, (w.thickness ?? DEFAULT_WALL_THICKNESS) + 0.12)
        const hit = nearestWallProjection(start[0], start[1], [w], reach)
        if (hit && (!host || hit.dist < host.dist)) host = hit
      }
      if (!host) return [start[0], z]
      const hw = others.find((w) => w.id === host!.wallId)
      if (!hw) return [start[0], z]
      const hdx = hw.b[0] - hw.a[0]
      if (Math.abs(hdx) > 0.08) return [start[0], z]
      const face = wallFacePointAt(hw, host.t, start[0], z, allWalls)
      return [face[0], z]
    }
    const a = reattach(startA)
    const b = reattach(startB)
    a2 = [a[0], z]
    b2 = [b[0], z]
    if (Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) < MIN_WALL_LEN_SLIDE) return null
    axis = 'z'
    delta = z - startA[1]
  }

  const slidWall: WallSeg = { ...wall, a: a2, b: b2 }
  const dependentUpdates: { id: string; a: [number, number]; b: [number, number] }[] = []

  for (const dep of dependents) {
    if (dep.parallel) {
      const dx = axis === 'x' ? delta : 0
      const dz = axis === 'z' ? delta : 0
      const na: [number, number] = [dep.startA[0] + dx, dep.startA[1] + dz]
      const nb: [number, number] = [dep.startB[0] + dx, dep.startB[1] + dz]
      dependentUpdates.push({ id: dep.id, a: na, b: nb })
      continue
    }

    // Perpendicular (or angled): keep the free tip, pin the attached tip onto the slid wall.
    const free: [number, number] =
      dep.handle === 'a'
        ? [dep.startB[0], dep.startB[1]]
        : [dep.startA[0], dep.startA[1]]
    const onHost = wallFacePointAt(slidWall, dep.t, free[0], free[1], [
      ...allWalls.filter((w) => w.id !== wall.id),
      slidWall,
    ])
    const na: [number, number] = dep.handle === 'a' ? onHost : free
    const nb: [number, number] = dep.handle === 'b' ? onHost : free
    if (Math.hypot(nb[0] - na[0], nb[1] - na[1]) < MIN_WALL_LEN_SLIDE) continue
    dependentUpdates.push({ id: dep.id, a: na, b: nb })
  }

  return { a: a2, b: b2, axis, delta, guides, dependentUpdates }
}


/** Offset of wall mesh center from a→b midpoint (for 3D). */
export function wallMeshCenterOffset(
  wall: WallSeg,
  allWalls: WallSeg[],
): { x: number; z: number } {
  if (wall.centerline) return { x: 0, z: 0 }
  const t = wall.thickness ?? DEFAULT_WALL_THICKNESS
  const { ix, iz } = wallInwardNormal(wall, allWalls)
  return { x: ix * (t / 2), z: iz * (t / 2) }
}

/** Joined centerline tips (for optional markers; overlap is handled by footprint extension). */
export function wallCornerFillCenters(
  walls: WallSeg[],
  joinTol = 0.12,
): { x: number; z: number; t: number }[] {
  const map = new Map<string, { x: number; z: number; t: number }>()
  const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`
  for (const w of walls) {
    if (w.glass) continue
    const t = w.thickness ?? DEFAULT_WALL_THICKNESS
    for (const p of [w.a, w.b] as const) {
      const joined = walls.some(
        (o) =>
          o.id !== w.id &&
          !o.glass &&
          (endpointsNear(o.a, p, joinTol) || endpointsNear(o.b, p, joinTol)),
      )
      if (!joined) continue
      const k = key(p[0], p[1])
      const prev = map.get(k)
      if (!prev || t > prev.t) map.set(k, { x: p[0], z: p[1], t })
    }
  }
  return [...map.values()]
}

/**
 * Snap onto a wall face toward `from`.
 * Drawing from inside a room hits the INNER face so partition length is clear
 * span only (host wall thickness is not included).
 */
export function snapPointToWallFace(
  x: number,
  z: number,
  fromX: number,
  fromZ: number,
  walls: WallSeg[],
  maxDist = 0.35,
): { point: [number, number]; wallId: string; t: number } | null {
  const hit = nearestWallProjection(x, z, walls, maxDist)
  if (!hit) return null
  const wall = walls.find((w) => w.id === hit.wallId)
  if (!wall) return null
  return {
    point: wallFacePointAt(wall, hit.t, fromX, fromZ, walls),
    wallId: wall.id,
    t: hit.t,
  }
}

/**
 * Inner-face point at parameter t (outer-edge model), or centerline face toward interior.
 * Used when branching partitions from mid-wall.
 */
export function wallInnerPointAt(
  wall: WallSeg,
  t: number,
  allWalls: WallSeg[],
): [number, number] {
  const edge = wallEdgePointAt(wall, t)
  const walls = allWalls.length ? allWalls : [wall]
  const { ix, iz } = wallInwardNormal(wall, walls)
  if (wall.centerline) {
    const { half } = wallAxes(wall)
    return [edge[0] + ix * half, edge[1] + iz * half]
  }
  const thick = wall.thickness ?? DEFAULT_WALL_THICKNESS
  return [edge[0] + ix * thick, edge[1] + iz * thick]
}

/** True when walls match the built-in apartment (use DEFAULT_ROOMS floors). */
export function usesDefaultRooms(walls: WallSeg[]): boolean {
  if (walls.length !== DEFAULT_WALLS.length) return false
  const ids = new Set(walls.map((w) => w.id))
  return DEFAULT_WALLS.every((w) => ids.has(w.id))
}

export function createWallId(): string {
  return `wall-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function makeWallSeg(
  a: [number, number],
  b: [number, number],
  thickness = DEFAULT_WALL_THICKNESS,
  opts?: { centerline?: boolean; side?: 1 | -1; glass?: boolean; screenHeight?: number },
): WallSeg {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (opts?.glass) {
    return {
      id: createWallId(),
      label: `Glass ${(len * 100).toFixed(0)} cm`,
      a: [...a] as [number, number],
      b: [...b] as [number, number],
      thickness: Math.min(thickness, 0.04),
      glass: true,
      screenHeight: opts.screenHeight ?? 2.0,
    }
  }
  return {
    id: createWallId(),
    ...(opts?.centerline ? { centerline: true } : {}),
    ...(opts?.side ? { side: opts.side } : {}),
    label: `Wall ${(len * 100).toFixed(0)} cm`,
    a: [...a] as [number, number],
    b: [...b] as [number, number],
    thickness,
    exterior: true,
  }
}

/** Soft-add built-in glass screens when the default bath layout is present but glass was omitted. */
export function softAddDefaultGlassPartitions(walls: WallSeg[]): WallSeg[] {
  const ids = new Set(walls.map((w) => w.id))
  const solidDefaults = DEFAULT_WALLS.filter((w) => !w.glass)
  // Only migrate the built-in apartment — never inject glass into a custom plan.
  if (!solidDefaults.every((w) => ids.has(w.id))) return walls
  const missing = GLASS_WALLS.filter((g) => !ids.has(g.id))
  if (!missing.length) return walls
  return [...walls, ...missing.map((g) => structuredClone(g))]
}

export const DEFAULT_OPENING_STATE: Record<string, boolean> = Object.fromEntries(
  ALL_OPENINGS.map((o) => [o.id, true]),
)

export const DEFAULT_PARTITION_STATE: Record<string, boolean> = Object.fromEntries(
  GLASS_WALLS.map((w) => [w.id, true]),
)

/** Mutable opening positions along each wall (0–1), plus optional clear sizes. */
export type OpeningLayoutEntry = {
  t0: number
  t1: number
  /** Window sill height (m); omitted = use OpeningDef default */
  sill?: number
  /** Clear opening height (m) for window pane or door leaf */
  height?: number
  /** User-added openings store ownership + kind here (built-ins omit these). */
  wallId?: string
  kind?: OpeningKind
  label?: string
  /** null clears a baked french/display/gate style */
  style?: 'display' | 'french' | 'gate' | null
  /** Soft-deleted from the plan (built-in or custom). */
  removed?: boolean
}
export type OpeningLayout = Record<string, OpeningLayoutEntry>

/** Mutable glass partition endpoints. */
export type PartitionLayout = Record<string, { a: [number, number]; b: [number, number] }>

export const DEFAULT_OPENING_LAYOUT: OpeningLayout = Object.fromEntries(
  ALL_OPENINGS.map((o) => [o.id, { t0: o.t0, t1: o.t1 }]),
)

export const DEFAULT_PARTITION_LAYOUT: PartitionLayout = Object.fromEntries(
  GLASS_WALLS.map((w) => [w.id, { a: [...w.a] as [number, number], b: [...w.b] as [number, number] }]),
)

function openingFromLayout(id: string, entry: OpeningLayoutEntry): OpeningDef | null {
  if (!entry.kind || entry.removed) return null
  const isGate = entry.kind === 'door' && entry.style === 'gate'
  const isFrench = entry.kind === 'door' && entry.style === 'french'
  return {
    id,
    label:
      entry.label ??
      (isGate ? 'Gate' : isFrench ? 'French door' : entry.kind === 'door' ? 'Door' : 'Window'),
    kind: entry.kind,
    t0: entry.t0,
    t1: entry.t1,
    sill: entry.sill,
    height: entry.height,
    ...(entry.style ? { style: entry.style } : {}),
  }
}

/** Built-in + user-added openings that are still on the plan. */
export function listPlanOpenings(
  layout: OpeningLayout,
  walls: WallSeg[] = DEFAULT_WALLS,
): OpeningDef[] {
  const baked = walls.flatMap((w) => w.openings ?? [])
  const bakedIds = new Set(baked.map((o) => o.id))
  const builtin = baked
    .filter((o) => layout[o.id]?.removed !== true)
    .map((o) => {
      const pos = layout[o.id]
      if (!pos) return o
      return {
        ...o,
        t0: pos.t0,
        t1: pos.t1,
        sill: pos.sill ?? o.sill,
        height: pos.height ?? o.height,
        style: pos.style === null ? undefined : (pos.style ?? o.style),
      }
    })
  const custom = Object.entries(layout)
    .filter(
      ([id, e]) =>
        Boolean(e.wallId && e.kind) && e.removed !== true && !bakedIds.has(id),
    )
    .map(([id, e]) => openingFromLayout(id, e))
    .filter((o): o is OpeningDef => o != null)
  return [...builtin, ...custom]
}

export function wallsWithOpenings(
  walls: WallSeg[],
  layout: OpeningLayout,
  enabled: Record<string, boolean>,
  partitionLayout: PartitionLayout = DEFAULT_PARTITION_LAYOUT,
  partitionsEnabled: Record<string, boolean> = DEFAULT_PARTITION_STATE,
): WallSeg[] {
  return walls
    .map((wall) => {
      if (wall.glass) {
        if (partitionsEnabled[wall.id] === false) {
          return { ...wall, a: wall.a, b: wall.a } // zero-length → skipped in render
        }
        const pos = partitionLayout[wall.id]
        return pos ? { ...wall, a: pos.a, b: pos.b } : wall
      }

      const builtin = (wall.openings ?? [])
        .filter((o) => enabled[o.id] !== false && layout[o.id]?.removed !== true)
        .map((o) => {
          const pos = layout[o.id]
          if (!pos) return o
          return {
            ...o,
            t0: pos.t0,
            t1: pos.t1,
            sill: pos.sill ?? o.sill,
            height: pos.height ?? o.height,
            style: pos.style === null ? undefined : (pos.style ?? o.style),
          }
        })

      const custom = Object.entries(layout)
        .filter(
          ([id, e]) =>
            e.wallId === wall.id &&
            e.kind != null &&
            e.removed !== true &&
            enabled[id] !== false &&
            !(wall.openings ?? []).some((o) => o.id === id),
        )
        .map(([id, e]) => openingFromLayout(id, e))
        .filter((o): o is OpeningDef => o != null)

      return {
        ...wall,
        openings: [...builtin, ...custom],
      }
    })
    .filter((w) => !(w.glass && Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) < 0.01))
}

/** Wall id that owns an opening */
export function wallIdForOpening(
  openingId: string,
  layout: OpeningLayout = DEFAULT_OPENING_LAYOUT,
  walls: WallSeg[] = DEFAULT_WALLS,
): string | null {
  const customWall = layout[openingId]?.wallId
  if (customWall) return customWall
  for (const w of walls) {
    if (w.openings?.some((o) => o.id === openingId)) return w.id
  }
  return null
}

/** Resolve OpeningDef for built-in or user-added id. */
export function resolveOpeningDef(
  openingId: string,
  layout: OpeningLayout,
  walls: WallSeg[] = DEFAULT_WALLS,
): OpeningDef | null {
  if (layout[openingId]?.removed) return null
  const custom = layout[openingId]
  if (custom?.wallId && custom.kind) {
    return openingFromLayout(openingId, custom)
  }
  const baked = walls.flatMap((w) => w.openings ?? [])
  const base = baked.find((o) => o.id === openingId)
  if (!base) return null
  const pos = layout[openingId]
  if (!pos) return base
  return {
    ...base,
    t0: pos.t0,
    t1: pos.t1,
    sill: pos.sill ?? base.sill,
    height: pos.height ?? base.height,
  }
}

/** Default clear width (m) when placing a new opening on a wall. */
export function defaultOpeningWidthM(kind: OpeningKind): number {
  return kind === 'door' ? 0.9 : 1.0
}

export function createOpeningId(kind: OpeningKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Place a new window/door/gate centered at parameter t along a wall. */
export function makeOpeningLayoutEntry(
  wallId: string,
  kind: OpeningKind,
  centerT: number,
  wallLength: number,
  opts?: { style?: 'display' | 'french' | 'gate' },
): OpeningLayoutEntry {
  const isFrench = kind === 'door' && opts?.style === 'french'
  const isGate = kind === 'door' && opts?.style === 'gate'
  const widthM = isFrench ? 1.4 : isGate ? 1.0 : defaultOpeningWidthM(kind)
  const half = Math.min(0.45, widthM / wallLength / 2)
  const mid = Math.min(1 - half, Math.max(half, centerT))
  return {
    wallId,
    kind,
    label: isGate ? 'Gate' : isFrench ? 'French door' : kind === 'door' ? 'Door' : 'Window',
    t0: mid - half,
    t1: mid + half,
    ...(kind === 'window'
      ? { sill: 0.9 }
      : { height: isFrench ? PATIO_OPENING_H : isGate ? 1.0 : 2.1 }),
    ...(opts?.style ? { style: opts.style } : {}),
  }
}

/** Resolve clear height / sill used by an opening (after layout merge). */
export function resolveOpeningVertical(
  opening: OpeningDef,
  wallHeight = 2.5,
): { height: number; sill: number } {
  if (opening.kind === 'door') {
    const height = Math.min(
      opening.height ??
        (opening.style === 'french'
          ? PATIO_OPENING_H
          : opening.style === 'gate'
            ? 1.0
            : Math.min(2.1, wallHeight * 0.78)),
      wallHeight - 0.05,
    )
    return { height, sill: 0 }
  }
  const sill = opening.sill ?? 0.9
  const defaultWinH = Math.min(1.4, Math.max(0.2, wallHeight - sill - 0.25))
  const height = Math.min(
    opening.height ?? defaultWinH,
    Math.max(0.2, wallHeight - sill - 0.12),
  )
  return { height, sill }
}

/** Helpers to place furniture flush to a wall */
const GAP = 0.02
function flushS(zWall: number, depth: number) {
  return zWall + depth / 2 + GAP
}
function flushN(zWall: number, depth: number) {
  return zWall - depth / 2 - GAP
}
function flushW(xWall: number, width: number) {
  return xWall + width / 2 + GAP
}
function flushE(xWall: number, width: number) {
  return xWall - width / 2 - GAP
}

export const INITIAL_FURNITURE: FurnitureDef[] = [
  // —— Living: TV on bedroom wall (north), sofa facing it ——
  {
    id: 'tv',
    type: 'tvStand',
    label: 'TV wall unit',
    position: [I + BR1_W * 0.42, 0, flushN(TOP_Z, 0.42)],
    rotation: Math.PI,
    size: [2.8, 2.05, 0.42],
  },
  {
    id: 'sofa',
    type: 'sofa',
    label: 'Sofa',
    position: [I + BR1_W * 0.42, 0, TOP_Z - 2.15],
    rotation: 0, // faces north / TV; chaise on right
    size: [2.55, 0.82, 1.75],
  },
  {
    id: 'rug-living',
    type: 'areaRug',
    label: 'Living rug',
    position: [I + BR1_W * 0.42, 0, TOP_Z - 1.2],
    rotation: 0,
    size: [2.5, 0.02, 1.55],
  },
  {
    id: 'dining-table',
    type: 'diningTable',
    label: 'Dining table',
    position: [I + BR1_W * 0.45, 0, TOP_Z - 3.1],
    rotation: 0,
    size: [1.3, 0.75, 0.75],
  },
  {
    id: 'chair-1',
    type: 'diningChair',
    label: 'Chair',
    position: [I + BR1_W * 0.45 - 0.45, 0, TOP_Z - 3.65],
    rotation: Math.PI,
    size: [0.45, 0.9, 0.5],
  },
  {
    id: 'chair-2',
    type: 'diningChair',
    label: 'Chair',
    position: [I + BR1_W * 0.45 + 0.45, 0, TOP_Z - 3.65],
    rotation: Math.PI,
    size: [0.45, 0.9, 0.5],
  },
  // Side cabinet flush to west wall
  {
    id: 'sideboard',
    type: 'sideboard',
    label: 'Side cabinet',
    position: [flushW(I, 0.4), 0, I + LIVING_D * 0.45],
    rotation: Math.PI / 2,
    size: [1.0, 0.75, 0.4],
  },
  // Kitchen L: south run meets a single return on the hall/stairs wall
  {
    id: 'kitchen',
    type: 'kitchen',
    label: 'Kitchen',
    // Ends at the return cabinet so the counter forms a continuous L
    position: [I + 0.06 + (HALL_X - I - 0.65 - 0.08) / 2, 0, flushS(I, 0.65)],
    rotation: 0,
    size: [HALL_X - I - 0.65 - 0.08, 0.9, 0.65],
  },
  {
    id: 'kitchen-return',
    type: 'kitchenCabinet',
    label: 'Kitchen cabinet',
    // Living side of stairs/hall wall — single unit forming the L return
    position: [flushE(HALL_X, 0.65), 0, I + 0.65 + 0.02 + 0.9 / 2],
    rotation: -Math.PI / 2,
    size: [0.9, 0.9, 0.65],
  },
  // Fridge on same wall, just north of the return cabinet
  {
    id: 'fridge',
    type: 'fridge',
    label: 'Fridge',
    position: [flushE(HALL_X, 0.7), 0, I + 0.65 + 0.02 + 0.9 + 0.04 + 0.65 / 2],
    rotation: -Math.PI / 2,
    size: [0.65, 1.9, 0.7],
  },

  // —— Bedroom 1: bed against south wall, wardrobe against east, desk against north ——
  {
    id: 'bed1',
    type: 'bedDouble',
    label: 'Double bed',
    position: [I + BR1_W * 0.38, 0, flushS(TOP_Z + PARTITION, 2.1)],
    rotation: 0, // headboard to south
    size: [1.8, 0.55, 2.1],
  },
  {
    id: 'rug-br1',
    type: 'rug',
    label: 'Bedroom rug',
    position: [I + BR1_W * 0.42, 0, flushS(TOP_Z + PARTITION, 2.1) + 0.15],
    rotation: 0,
    size: [2.4, 0.02, 2.8],
  },
  {
    id: 'ns1',
    type: 'nightstand',
    label: 'Nightstand',
    position: [I + BR1_W * 0.38 + 1.15, 0, flushS(TOP_Z + PARTITION, 0.4)],
    rotation: 0,
    size: [0.4, 0.55, 0.4],
  },
  {
    id: 'lamp-ns1',
    type: 'tableLamp',
    label: 'Bedside lamp',
    position: [I + BR1_W * 0.38 + 1.15, 0.55, flushS(TOP_Z + PARTITION, 0.4)],
    rotation: 0,
    size: [0.22, 0.4, 0.22],
  },
  {
    id: 'vase-ns1',
    type: 'vase',
    label: 'Vase',
    position: [I + BR1_W * 0.38 + 1.28, 0.55, flushS(TOP_Z + PARTITION, 0.4) + 0.08],
    rotation: 0,
    size: [0.08, 0.22, 0.08],
  },
  {
    id: 'wardrobe1',
    type: 'wardrobe',
    label: 'Wardrobe',
    position: [flushE(BR1_X, 0.6), 0, TOP_Z + PARTITION + BR_D * 0.55],
    rotation: -Math.PI / 2,
    size: [2.4, 2.1, 0.6],
  },
  {
    id: 'desk1',
    type: 'desk',
    label: 'Desk',
    position: [flushW(I, 0.6), 0, flushN(NORTH, 0.6)],
    rotation: 0,
    size: [1.2, 0.75, 0.6],
  },
  {
    id: 'chair-desk1',
    type: 'deskChair',
    label: 'Desk chair',
    position: [I + 0.7, 0, NORTH - 1.15],
    rotation: 0,
    size: [0.5, 0.85, 0.5],
  },

  // —— Bedroom 2: desk north, wardrobe + single bed against east wall ——
  {
    id: 'desk2',
    type: 'desk',
    label: 'Desk',
    position: [BR1_X + PARTITION + 0.9, 0, flushN(NORTH, 0.55)],
    rotation: 0,
    size: [1.1, 0.75, 0.55],
  },
  {
    id: 'chair-desk2',
    type: 'deskChair',
    label: 'Desk chair',
    position: [BR1_X + PARTITION + 0.9, 0, NORTH - 1.1],
    rotation: 0,
    size: [0.5, 0.85, 0.5],
  },
  {
    id: 'wardrobe2',
    type: 'wardrobe',
    label: 'Wardrobe',
    position: [flushE(W - I, 0.55), 0, NORTH - 0.9],
    rotation: -Math.PI / 2,
    size: [1.2, 2.1, 0.55],
  },
  {
    id: 'bed2',
    type: 'bedSingle',
    label: 'Single bed',
    position: [flushE(W - I, 1.0), 0, TOP_Z + PARTITION + 1.1],
    rotation: -Math.PI / 2, // long side along east wall
    size: [1.0, 0.5, 2.0],
  },

  // —— Office: desk + stacked washer/dryer beside desk ——
  {
    id: 'desk-office',
    type: 'desk',
    label: 'Office desk',
    position: [RX + RIGHT_W * 0.4, 0, flushS(MID_Z + PARTITION, 0.7)],
    rotation: Math.PI,
    size: [1.4, 0.75, 0.7],
  },
  {
    id: 'chair-office',
    type: 'officeChair',
    label: 'Office chair',
    position: [RX + RIGHT_W * 0.4, 0, MID_Z + PARTITION + 1.15],
    rotation: Math.PI,
    size: [0.55, 0.95, 0.55],
  },
  {
    id: 'washer',
    type: 'washer',
    label: 'Washer',
    position: [RX + RIGHT_W * 0.82, 0, flushS(MID_Z + PARTITION, 0.6)],
    rotation: Math.PI,
    size: [0.6, 0.85, 0.6],
  },
  {
    id: 'dryer',
    type: 'dryer',
    label: 'Dryer',
    position: [RX + RIGHT_W * 0.82, 0.85, flushS(MID_Z + PARTITION, 0.6)],
    rotation: Math.PI,
    size: [0.6, 0.85, 0.6],
  },

  // —— Bathroom: door (west) faces toilet (east); wash basin; bath; full-width cupboard ——
  {
    id: 'toilet',
    type: 'toilet',
    label: 'Wall-hung toilet',
    position: [flushE(W - I, 0.55), 0, I + BATH_D * 0.55],
    rotation: -Math.PI / 2, // faces west toward door
    size: [0.38, 0.4, 0.55],
  },
  {
    id: 'bath-sink',
    type: 'bathSink',
    label: 'Wash basin',
    position: [flushW(RX + PARTITION / 2, 0.5), 0, I + BATH_D * 0.22],
    rotation: Math.PI / 2,
    size: [0.7, 0.9, 0.5],
  },
  {
    id: 'bath-mirror',
    type: 'mirror',
    label: 'Bathroom mirror',
    // On the west bath wall above the basin
    position: [flushW(RX + PARTITION / 2, 0.05), 1.35, I + BATH_D * 0.22],
    rotation: Math.PI / 2,
    size: [0.55, 0.75, 0.05],
  },
  {
    id: 'bathtub',
    type: 'bathtub',
    label: 'Bathtub',
    position: [RX + 0.95, 0, flushS(I, 0.7)],
    rotation: 0,
    size: [1.55, 0.55, 0.7],
  },
  {
    id: 'bath-cupboard',
    type: 'wardrobe',
    label: 'Bathroom cupboard',
    // Narrow unit snug to the right of the bathtub
    position: [RX + 0.95 + 1.55 / 2 + 0.32, 0, flushS(I, 0.48)],
    rotation: 0,
    size: [0.6, 2.15, 0.48],
  },

  // —— Stairs against entrance, rotated 180°, no wall on entrance side ——
  {
    id: 'stairs',
    type: 'stairs',
    label: 'Stairs',
    position: [HALL_X + STAIR_W / 2 + 0.04, 0, I + STAIR_RUN / 2 + 0.02],
    rotation: Math.PI,
    size: STAIRS_SIZE,
  },
]

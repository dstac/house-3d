import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ROOMS,
  createOpeningId,
  draftWallReferenceMeasures,
  findCustomRectangularRooms,
  makeOpeningLayoutEntry,
  makeWallSeg,
  nearestWallProjection,
  planCanvasBounds,
  snapPointToWallFace,
  wallEdgeLength,
  draftEdgeLength,
  wallFacePointAt,
  wallEdgePointAt,
  wallInnerPointAt,
  wallFootprintCorners,
  wallInwardNormal,
  wallEffectiveSide,
  wallCornerFills,
  absorbOuterCornerIntoLength,
  wallCornerLengthExtensions,
  isInteriorPartition,
  slideInteriorWall,
  findSlideDependents,
  continuationSide,
  loopInwardSides,
  wallsWithOpenings,
  makeCeilingLight,
  makeStripFromEndpoints,
  normalizeRoomKind,
  ROOM_KIND_LABEL,
  terraceFenceWallIds,
  type BuildingBounds,
  type CeilingLightDef,
  type CeilingLightKind,
  type FurnitureDef,
  type OpeningLayout,
  type OpeningLayoutEntry,
  type PartitionLayout,
  type RoomKind,
  type SlideDependent,
  type WallSeg,
} from '../data/floorPlan'
import { snapFurnitureMove, type SnapGuide } from '../lib/snapToWalls'
import { PlanFurnitureSymbol } from './planFurnitureIcons'

interface FloorPlan2DProps {
  furniture: FurnitureDef[]
  walls: WallSeg[]
  building: BuildingBounds
  useDefaultRooms: boolean
  northAngle: number
  onNorthAngleChange: (angle: number) => void
  compassU?: number
  compassV?: number
  onCompassPosChange: (u: number, v: number) => void
  showRoomDimensions: boolean
  showInnerArea: boolean
  showOuterArea: boolean
  showWallLengths: boolean
  showFurniture2D: boolean
  onShowFurniture2DChange: (show: boolean) => void
  showCompass: boolean
  onShowCompassChange: (show: boolean) => void
  openingsEnabled: Record<string, boolean>
  openingLayout: OpeningLayout
  partitionLayout: PartitionLayout
  partitionsEnabled: Record<string, boolean>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMoveFurniture: (id: string, position: [number, number, number]) => void
  onResizeFurniture: (
    id: string,
    size: [number, number, number],
    position: [number, number, number],
  ) => void
  onRotateFurniture: (id: string, delta: number) => void
  onPatchFurniture: (id: string, next: Partial<FurnitureDef>) => void
  onEditSize: (id: string) => void
  onUpdateOpening: (id: string, next: OpeningLayoutEntry) => void
  onEditOpening: (id: string) => void
  onAddOpening: (id: string, entry: OpeningLayoutEntry) => void
  onRemoveOpening: (id: string) => void
  onAddWall: (wall: WallSeg) => void
  onUpdateWall: (id: string, next: Partial<WallSeg>) => void
  onRemoveWall: (id: string) => void
  drawWallThickness: number
  onDrawWallThicknessChange: (t: number) => void
  roomNames: Record<string, string>
  roomKinds: Record<string, RoomKind>
  onRenameRoom: (id: string, name: string) => void
  onSetRoomKind: (id: string, kind: RoomKind) => void
  onEditRoom: (id: string) => void
  onMovePartition: (id: string, a: [number, number], b: [number, number]) => void
  ceilingLights: CeilingLightDef[]
  onAddCeilingLight: (light: CeilingLightDef) => void
  onUpdateCeilingLight: (id: string, next: Partial<CeilingLightDef>) => void
  onRemoveCeilingLight: (id: string) => void
}

type PlaceTool =
  | 'select'
  | 'move'
  | 'slide'
  | 'wall'
  | 'glass'
  | 'window'
  | 'door'
  | 'french-door'
  | 'gate'
  | 'measure'
  | 'ceil-strip'
  | 'ceil-industrial'
  | 'ceil-globe'

/** Where a draft wall starts — resolved to a face/corner as the end moves. */
type DraftAnchor =
  | { kind: 'wall-face'; wallId: string; t: number }
  | { kind: 'corner'; wallId: string; handle: 'a' | 'b' }
  | { kind: 'free'; point: [number, number] }

type ResizeHandle = 'e' | 'w' | 'n' | 's'

type DragTarget =
  | { kind: 'furniture'; id: string; ox: number; oz: number }
  | { kind: 'opening'; id: string; wallId: string; span: number }
  | {
      kind: 'opening-resize'
      id: string
      wallId: string
      handle: 'start' | 'end'
      fixedT: number
    }
  | {
      kind: 'partition'
      id: string
      ox: number
      oz: number
      startA: [number, number]
      startB: [number, number]
    }
  | {
      kind: 'wall-end'
      id: string
      handle: 'a' | 'b'
    }
  | {
      kind: 'wall-move'
      id: string
      ox: number
      oz: number
      startA: [number, number]
      startB: [number, number]
    }
  | {
      kind: 'wall-slide'
      id: string
      ox: number
      oz: number
      startA: [number, number]
      startB: [number, number]
      dependents: SlideDependent[]
    }
  | {
      kind: 'resize'
      id: string
      handle: ResizeHandle
      startW: number
      startD: number
      startX: number
      startZ: number
      startMx: number
      startMz: number
      rotation: number
    }
  | { kind: 'north-rotate' }
  | {
      kind: 'north-move'
      ox: number
      oy: number
      startU: number
      startV: number
    }
  | { kind: 'ceiling'; id: string; ox: number; oz: number }
  | {
      kind: 'view-pan'
      startClientX: number
      startClientY: number
      startPanX: number
      startPanZ: number
    }

const PAD = 1.15
const MIN_SIZE = 0.25
const MIN_OPENING_W = 0.4
const MIN_WALL_LEN = 0.15
const ENDPOINT_SNAP = 0.18
const ALIGN_SNAP = 0.12
const HANDLE = 0.12
const OPEN_HANDLE = 0.1
const WALL_HANDLE = 0.14
const COMPASS_R = 0.48
/** Room clear-size dimension lines (distinct from blue wall lengths) */
const ROOM_DIM_STROKE = '#ea580c'
const ROOM_DIM_FILL = '#c2410c'
const VIEW_SCALE_MIN = 0.04 // smaller = closer zoom (~25×)
const VIEW_SCALE_MAX = 4.5

type AlignGuide = { axis: 'x' | 'z'; at: number }

function worldToLocal(dx: number, dz: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  // inverse Y-rotation in XZ
  return { lx: c * dx - s * dz, lz: s * dx + c * dz }
}

function localToWorld(lx: number, lz: number, rot: number) {
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  return { x: c * lx + s * lz, z: -s * lx + c * lz }
}

function snapWallPoint(
  x: number,
  z: number,
  walls: WallSeg[],
  start: [number, number] | null,
  freeAngle: boolean,
): { x: number; z: number; guides: AlignGuide[] } {
  let sx = x
  let sz = z
  const guides: AlignGuide[] = []

  // 1) Endpoint snap (highest priority)
  let best = ENDPOINT_SNAP
  let hitEnd: [number, number] | null = null
  for (const w of walls) {
    for (const p of [w.a, w.b] as const) {
      const d = Math.hypot(p[0] - sx, p[1] - sz)
      if (d < best) {
        best = d
        hitEnd = [p[0], p[1]]
      }
    }
  }
  if (hitEnd) {
    sx = hitEnd[0]
    sz = hitEnd[1]
    guides.push({ axis: 'x', at: sx }, { axis: 'z', at: sz })
    return { x: sx, z: sz, guides }
  }

  // 2) Align to existing wall endpoint X / Z (puncture / construction lines)
  const xs = new Set<number>()
  const zs = new Set<number>()
  for (const w of walls) {
    xs.add(w.a[0])
    xs.add(w.b[0])
    zs.add(w.a[1])
    zs.add(w.b[1])
  }
  if (start) {
    xs.add(start[0])
    zs.add(start[1])
  }

  let bestX = ALIGN_SNAP
  let snapX: number | null = null
  for (const vx of xs) {
    const d = Math.abs(sx - vx)
    if (d < bestX) {
      bestX = d
      snapX = vx
    }
  }
  let bestZ = ALIGN_SNAP
  let snapZ: number | null = null
  for (const vz of zs) {
    const d = Math.abs(sz - vz)
    if (d < bestZ) {
      bestZ = d
      snapZ = vz
    }
  }
  if (snapX != null) {
    sx = snapX
    guides.push({ axis: 'x', at: snapX })
  }
  if (snapZ != null) {
    sz = snapZ
    guides.push({ axis: 'z', at: snapZ })
  }

  // 3) Orthogonal relative to start (unless Shift)
  if (start && !freeAngle) {
    const dx = Math.abs(sx - start[0])
    const dz = Math.abs(sz - start[1])
    if (dx >= dz) {
      sz = start[1]
      if (!guides.some((g) => g.axis === 'z' && Math.abs(g.at - sz) < 1e-9)) {
        guides.push({ axis: 'z', at: sz })
      }
      if (!guides.some((g) => g.axis === 'x' && Math.abs(g.at - start[0]) < 1e-9)) {
        guides.push({ axis: 'x', at: start[0] })
      }
    } else {
      sx = start[0]
      if (!guides.some((g) => g.axis === 'x' && Math.abs(g.at - sx) < 1e-9)) {
        guides.push({ axis: 'x', at: sx })
      }
      if (!guides.some((g) => g.axis === 'z' && Math.abs(g.at - start[1]) < 1e-9)) {
        guides.push({ axis: 'z', at: start[1] })
      }
    }
  }

  return { x: sx, z: sz, guides }
}

/** Monochrome interactive plan — draw walls; drag/resize furniture & openings. */
export default function FloorPlan2D({
  furniture,
  walls: wallSource,
  building,
  useDefaultRooms,
  showRoomDimensions,
  showInnerArea,
  showOuterArea,
  showWallLengths,
  showFurniture2D,
  onShowFurniture2DChange,
  showCompass,
  onShowCompassChange,
  northAngle,
  onNorthAngleChange,
  compassU,
  compassV,
  onCompassPosChange,
  openingsEnabled,
  openingLayout,
  partitionLayout,
  partitionsEnabled,
  selectedId,
  onSelect,
  onMoveFurniture,
  onResizeFurniture,
  onRotateFurniture,
  onPatchFurniture,
  onEditSize,
  onUpdateOpening,
  onEditOpening,
  onAddOpening,
  onRemoveOpening,
  onAddWall,
  onUpdateWall,
  onRemoveWall,
  drawWallThickness,
  onDrawWallThicknessChange,
  roomNames,
  roomKinds,
  onRenameRoom,
  onSetRoomKind,
  onEditRoom,
  onMovePartition,
  ceilingLights,
  onAddCeilingLight,
  onUpdateCeilingLight,
  onRemoveCeilingLight,
}: FloorPlan2DProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragTarget | null>(null)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [placeTool, setPlaceTool] = useState<PlaceTool>('select')
  const [ceilingPlanMode, setCeilingPlanMode] = useState(false)
  const [stripDraftStart, setStripDraftStart] = useState<[number, number] | null>(null)
  const [stripDraftEnd, setStripDraftEnd] = useState<[number, number] | null>(null)
  const isDrawWallTool = placeTool === 'wall' || placeTool === 'glass'
  const isPlaceOpeningTool =
    placeTool === 'window' ||
    placeTool === 'door' ||
    placeTool === 'french-door' ||
    placeTool === 'gate'
  const isPlaceCeilingTool =
    placeTool === 'ceil-strip' ||
    placeTool === 'ceil-industrial' ||
    placeTool === 'ceil-globe'
  const isDrawStripTool = placeTool === 'ceil-strip'
  const [wallDraftStart, setWallDraftStart] = useState<[number, number] | null>(null)
  const [wallDraftEnd, setWallDraftEnd] = useState<[number, number] | null>(null)
  const [wallDraftAnchor, setWallDraftAnchor] = useState<DraftAnchor | null>(null)
  const [hoverMeasure, setHoverMeasure] = useState<{
    wallId: string
    point: [number, number]
    facePoint: [number, number]
    t: number
    alongA: number
    alongB: number
    wallLen: number
    /** Corner continue shares centerline tip; face is for mid-wall branches. */
    mode: 'corner' | 'face'
    handle?: 'a' | 'b'
  } | null>(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  /** Tab while drafting: put the wall body on the other side of the drawn line. */
  const [draftFlip, setDraftFlip] = useState(false)
  /** Live offset while sliding an interior wall (m). */
  const [slideDelta, setSlideDelta] = useState<number | null>(null)
  const [wallAlignGuides, setWallAlignGuides] = useState<AlignGuide[]>([])
  /** >1 = zoomed out (see more of the canvas). */
  const [viewScale, setViewScale] = useState(1)
  /** World-space pan of the view (m). */
  const [viewPan, setViewPan] = useState({ x: 0, z: 0 })
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  /** Expand-only frame so drawing never zooms the SVG mid-sketch. */
  const canvasFloorRef = useRef<BuildingBounds | null>(null)
  const [wallLengthEdit, setWallLengthEdit] = useState<{
    wallId: string
    fixA: boolean
    lengthCm: string
  } | null>(null)
  const lengthInputRef = useRef<HTMLInputElement>(null)
  const lastWallClickRef = useRef<{ id: string; at: number; x: number; y: number } | null>(
    null,
  )

  const viewBuilding = useMemo(() => {
    if (useDefaultRooms) {
      canvasFloorRef.current = null
      return building
    }
    const needed = planCanvasBounds(wallSource)
    if (!wallSource.length) {
      canvasFloorRef.current = needed
      return needed
    }
    const prev = canvasFloorRef.current
    if (!prev) {
      canvasFloorRef.current = needed
      return needed
    }
    const minX = Math.min(prev.minX, needed.minX)
    const minZ = Math.min(prev.minZ, needed.minZ)
    const maxX = Math.max(prev.minX + prev.w, needed.minX + needed.w)
    const maxZ = Math.max(prev.minZ + prev.d, needed.minZ + needed.d)
    const w = Math.max(1, maxX - minX)
    const d = Math.max(1, maxZ - minZ)
    const next: BuildingBounds = {
      minX,
      minZ,
      w,
      d,
      centerX: minX + w / 2,
      centerZ: minZ + d / 2,
    }
    canvasFloorRef.current = next
    return next
  }, [useDefaultRooms, building, wallSource])

  const scale = Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, viewScale))
  const worldW = viewBuilding.w * scale
  const worldD = viewBuilding.d * scale
  const originX = viewBuilding.minX - (worldW - viewBuilding.w) / 2 + viewPan.x
  const originZ = viewBuilding.minZ - (worldD - viewBuilding.d) / 2 + viewPan.z
  const vbW = worldW + PAD * 2
  const vbH = worldD + PAD * 2

  // Compass — fractional position so zoom/pan of the frame keeps relative placement
  const defaultCompassU = (PAD * 0.55 + COMPASS_R) / vbW
  const defaultCompassV = (PAD * 0.55 + COMPASS_R) / vbH
  const compassCx = Math.min(
    vbW - COMPASS_R - 0.08,
    Math.max(COMPASS_R + 0.08, (compassU ?? defaultCompassU) * vbW),
  )
  const compassCy = Math.min(
    vbH - COMPASS_R - 0.35,
    Math.max(COMPASS_R + 0.08, (compassV ?? defaultCompassV) * vbH),
  )
  const northDeg = (((northAngle * 180) / Math.PI) % 360 + 360) % 360

  const tx = useCallback((x: number) => x - originX + PAD, [originX])
  const ty = useCallback((z: number) => worldD - (z - originZ) + PAD, [worldD, originZ])

  const svgLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    return pt.matrixTransform(ctm.inverse())
  }, [])

  const angleFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const local = svgLocal(clientX, clientY)
      if (!local) return null
      const dx = local.x - compassCx
      const dy = local.y - compassCy
      // 0 = up on drawing (plan north / +Z)
      return Math.atan2(dx, -dy)
    },
    [svgLocal, compassCx, compassCy],
  )

  const svgToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const local = svgLocal(clientX, clientY)
      if (!local) return null
      return {
        x: local.x - PAD + originX,
        z: originZ + worldD - (local.y - PAD),
      }
    },
    [svgLocal, originX, originZ, worldD],
  )

  const walls = useMemo(
    () =>
      wallsWithOpenings(
        wallSource,
        openingLayout,
        openingsEnabled,
        partitionLayout,
        partitionsEnabled,
      ),
    [wallSource, openingLayout, openingsEnabled, partitionLayout, partitionsEnabled],
  )

  const openingIds = useMemo(
    () => new Set(walls.flatMap((w) => (w.openings ?? []).map((o) => o.id))),
    [walls],
  )
  const selectedIsOpening = Boolean(selectedId && openingIds.has(selectedId))
  const selectedAnyWall = walls.find((w) => w.id === selectedId) ?? null
  const selectedWall =
    selectedAnyWall && !selectedAnyWall.glass ? selectedAnyWall : null
  const selectedFurniture = furniture.find((f) => f.id === selectedId) ?? null
  const cornerFills = useMemo(
    () => (useDefaultRooms ? [] : wallCornerFills(wallSource)),
    [useDefaultRooms, wallSource],
  )
  const customRooms = useMemo(
    () => (useDefaultRooms ? [] : findCustomRectangularRooms(wallSource)),
    [useDefaultRooms, wallSource],
  )
  const fenceWallIds = useMemo(
    () => terraceFenceWallIds(customRooms, roomKinds),
    [customRooms, roomKinds],
  )

  const draftRefs = useMemo(() => {
    if (!wallDraftStart || !wallDraftEnd) return []
    return draftWallReferenceMeasures(wallDraftStart, wallDraftEnd, wallSource)
  }, [wallDraftStart, wallDraftEnd, wallSource])

  // Reset zoom/pan when starting a blank canvas vs loading default apartment
  useEffect(() => {
    setViewScale(1)
    setViewPan({ x: 0, z: 0 })
  }, [useDefaultRooms])

  const placeOpeningOnWall = useCallback(
    (wallId: string, clientX: number, clientY: number) => {
      if (
        placeTool !== 'window' &&
        placeTool !== 'door' &&
        placeTool !== 'french-door' &&
        placeTool !== 'gate'
      ) {
        return
      }
      const wall = wallSource.find((w) => w.id === wallId)
      if (!wall || wall.glass) return
      const world = svgToWorld(clientX, clientY)
      if (!world) return
      const [ax, az] = wall.a
      const [bx, bz] = wall.b
      const dx = bx - ax
      const dz = bz - az
      const len2 = dx * dx + dz * dz || 1
      const t = Math.min(1, Math.max(0, ((world.x - ax) * dx + (world.z - az) * dz) / len2))
      const wallLen = Math.sqrt(len2)
      const kind = placeTool === 'window' ? 'window' : 'door'
      const id = createOpeningId(kind)
      const onFence = fenceWallIds.has(wallId)
      const style =
        placeTool === 'french-door'
          ? ('french' as const)
          : placeTool === 'gate' || (placeTool === 'door' && onFence)
            ? ('gate' as const)
            : undefined
      const entry = makeOpeningLayoutEntry(wallId, kind, t, wallLen, style ? { style } : undefined)
      onAddOpening(id, entry)
      onSelect(id)
      setPlaceTool('select')
    },
    [placeTool, svgToWorld, onAddOpening, onSelect, wallSource, fenceWallIds],
  )

  const resolveDraftStart = useCallback(
    (anchor: DraftAnchor, end: [number, number]): [number, number] => {
      if (anchor.kind === 'free') return anchor.point
      const wall = wallSource.find((w) => w.id === anchor.wallId)
      if (!wall) return end
      // Continuous / corner (perimeter): share the outer tip.
      if (anchor.kind === 'corner') {
        return anchor.handle === 'a' ? [...wall.a] : [...wall.b]
      }
      // Mid-wall partition: start on the host FACE that looks toward where we're
      // drawing, so the length is the clear span only (host body excluded). This is
      // direction-aware, which matters for centerline partitions that have a face on
      // each side — never start on their centerline.
      const onLine = wallEdgePointAt(wall, anchor.t)
      if (Math.hypot(end[0] - onLine[0], end[1] - onLine[1]) < 0.02) {
        return wallInnerPointAt(wall, anchor.t, wallSource)
      }
      return wallFacePointAt(wall, anchor.t, end[0], end[1], wallSource)
    },
    [wallSource],
  )

  const resolveDraftEnd = useCallback(
    (start: [number, number], rawEnd: [number, number]): [number, number] => {
      const partitionMode = wallDraftAnchor?.kind === 'wall-face'
      let best = ENDPOINT_SNAP
      let hit: [number, number] | null = null

      for (const w of wallSource) {
        if (w.glass) continue
        if (wallDraftAnchor?.kind === 'corner' && w.id === wallDraftAnchor.wallId) continue
        if (wallDraftAnchor?.kind === 'wall-face' && w.id === wallDraftAnchor.wallId) continue

        if (partitionMode) {
          // Snap to face corners on OUR side of the wall — stay in the clear area.
          // Face is chosen toward the draft start (works for centerline partitions too).
          // Pointer snapping may already have jumped to the tip on the line, which sits
          // up to t·√2 away from the face corner, so widen the radius by that much.
          const reach = ENDPOINT_SNAP + (w.thickness ?? 0) * 1.5
          for (const t of [0, 1] as const) {
            const p = wallFacePointAt(w, t, start[0], start[1], wallSource)
            if (Math.hypot(p[0] - start[0], p[1] - start[1]) < 0.05) continue
            const d = Math.hypot(p[0] - rawEnd[0], p[1] - rawEnd[1])
            if (d < reach && d < best) {
              best = d
              hit = p
            }
          }
        } else {
          for (const p of [w.a, w.b] as const) {
            if (Math.hypot(p[0] - start[0], p[1] - start[1]) < 0.05) continue
            const d = Math.hypot(p[0] - rawEnd[0], p[1] - rawEnd[1])
            if (d < best) {
              best = d
              hit = [p[0], p[1]]
            }
          }
        }
      }
      if (hit) return hit

      // Mid-span: face toward the draft start (inner face when drawing from inside)
      const face = snapPointToWallFace(
        rawEnd[0],
        rawEnd[1],
        start[0],
        start[1],
        wallSource.filter((w) => {
          if (wallDraftAnchor?.kind === 'wall-face' && w.id === wallDraftAnchor.wallId) {
            return false
          }
          if (wallDraftAnchor?.kind === 'corner' && w.id === wallDraftAnchor.wallId) {
            return false
          }
          return true
        }),
      )
      return face ? face.point : rawEnd
    },
    [wallSource, wallDraftAnchor],
  )

  const clearWallDraft = useCallback(() => {
    setWallDraftStart(null)
    setWallDraftEnd(null)
    setWallDraftAnchor(null)
    setHoverMeasure(null)
    setWallAlignGuides([])
    setDraftFlip(false)
  }, [])

  const clearStripDraft = useCallback(() => {
    setStripDraftStart(null)
    setStripDraftEnd(null)
  }, [])

  const commitStripDraft = useCallback(
    (end: [number, number]) => {
      if (!stripDraftStart) return
      let b: [number, number] = end
      if (shiftHeld) {
        const dx = Math.abs(end[0] - stripDraftStart[0])
        const dz = Math.abs(end[1] - stripDraftStart[1])
        b =
          dx >= dz
            ? [end[0], stripDraftStart[1]]
            : [stripDraftStart[0], end[1]]
      }
      const light = makeStripFromEndpoints(stripDraftStart, b)
      clearStripDraft()
      if (!light) return
      onAddCeilingLight(light)
      setPlaceTool('select')
    },
    [stripDraftStart, shiftHeld, clearStripDraft, onAddCeilingLight],
  )

  /**
   * Thickness side for the wall being drawn. The drawn line is always a FACE; the body
   * goes to one side only, so the length you draw is the exact clear length.
   * Default: continue the neighbour's body across a shared tip (closed corner),
   * otherwise right-hand side of travel. Tab flips.
   */
  const draftSide = useCallback(
    (start: [number, number]): 1 | -1 => {
      // -1 = right-hand side of travel on screen (north-up); clockwise shells go inward
      let base: 1 | -1 = -1
      if (wallDraftAnchor?.kind === 'corner') {
        const w = wallSource.find((x) => x.id === wallDraftAnchor.wallId)
        if (w) {
          const eff = wallEffectiveSide(w, wallSource)
          base = wallDraftAnchor.handle === 'b' ? eff : eff === 1 ? -1 : 1
        }
      } else if (wallDraftAnchor?.kind !== 'wall-face') {
        const cont = continuationSide(start, wallSource)
        if (cont) base = cont
      }
      return draftFlip ? (base === 1 ? -1 : 1) : base
    },
    [wallDraftAnchor, wallSource, draftFlip],
  )

  const commitWallDraft = useCallback(
    (rawEnd: [number, number]) => {
      if (!wallDraftAnchor && !wallDraftStart) return
      const anchor: DraftAnchor =
        wallDraftAnchor ??
        (wallDraftStart ? { kind: 'free', point: wallDraftStart } : { kind: 'free', point: rawEnd })
      const start = resolveDraftStart(anchor, rawEnd)
      const end = resolveDraftEnd(start, rawEnd)
      const len = Math.hypot(end[0] - start[0], end[1] - start[1])
      if (len < MIN_WALL_LEN) {
        clearWallDraft()
        return
      }
      if (placeTool === 'glass') {
        onAddWall(makeWallSeg(start, end, 0.02, { glass: true, screenHeight: 2.0 }))
        clearWallDraft()
        setPlaceTool('select')
        return
      }
      const wall = makeWallSeg(start, end, drawWallThickness, { side: draftSide(start) })
      // Walls that already bound a registered room are frozen: a new loop (terrace,
      // extension) sharing them must not flip their body side or retract their tips,
      // otherwise the existing room's clear area / dimensions would change.
      const lockedWallIds = new Set(customRooms.flatMap((r) => r.wallIds))
      // Closing a loop: turn every body of that loop toward its interior so the
      // outer 90° corners are solid regardless of the direction it was drawn in.
      const loop = loopInwardSides(wall, [...wallSource, wall])
      if (loop) {
        const mine = loop.get(wall.id)
        if (mine) wall.side = mine
        for (const [id, side] of loop) {
          if (id === wall.id || lockedWallIds.has(id)) continue
          const w = wallSource.find((x) => x.id === id)
          if (w && !w.centerline && wallEffectiveSide(w, wallSource) !== side) {
            onUpdateWall(id, { side })
          }
        }
      }
      // Outer-corner fills sit past the drawn tip — pull tips back so the length
      // you just drew already includes the corner (face + fill = drawn cm).
      const wallsForAbsorb = wallSource.map((w) => {
        if (!loop || lockedWallIds.has(w.id)) return w
        const side = loop.get(w.id)
        return side && !w.centerline ? { ...w, side } : w
      })
      const absorbed = absorbOuterCornerIntoLength(
        wall,
        [...wallsForAbsorb, wall],
        undefined,
        lockedWallIds,
      )
      for (const u of absorbed.neighbourUpdates) {
        onUpdateWall(u.id, { a: u.a, b: u.b })
      }
      onAddWall(absorbed.wall)
      // Keep drawing from the new tip (after corner absorb)
      const continueAt = absorbed.wall.b
      setPlaceTool('wall')
      setWallDraftAnchor({ kind: 'free', point: continueAt })
      setWallDraftStart(continueAt)
      setWallDraftEnd(continueAt)
      setHoverMeasure(null)
      setDraftFlip(false)
    },
    [
      wallDraftAnchor,
      wallDraftStart,
      resolveDraftStart,
      resolveDraftEnd,
      clearWallDraft,
      drawWallThickness,
      draftSide,
      onAddWall,
      onUpdateWall,
      wallSource,
      placeTool,
      customRooms,
    ],
  )

  const startWallFromCorner = useCallback(
    (wallId: string, handle: 'a' | 'b') => {
      const wall = wallSource.find((w) => w.id === wallId)
      if (!wall) return
      const tip = handle === 'a' ? wall.a : wall.b
      setPlaceTool('wall')
      onSelect(null)
      // Anchor to the live outer tip so the new wall shares that exact point
      setWallDraftAnchor({ kind: 'corner', wallId, handle })
      setWallDraftStart([tip[0], tip[1]])
      setWallDraftEnd([tip[0], tip[1]])
      setHoverMeasure(null)
    },
    [wallSource, onSelect],
  )

  const startWallFromFace = useCallback(
    (wallId: string, t: number, _facePoint: [number, number]) => {
      const wall = wallSource.find((w) => w.id === wallId)
      if (!wall) return
      // Partition starts on the room-side (inner) face — length stays in clear area
      const startPt = wallInnerPointAt(wall, t, wallSource)
      setPlaceTool('wall')
      onSelect(null)
      setWallDraftAnchor({ kind: 'wall-face', wallId, t })
      setWallDraftStart(startPt)
      setWallDraftEnd(startPt)
      setHoverMeasure(null)
    },
    [wallSource, onSelect],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(e.type === 'keydown')
      if (e.key === 'Escape') {
        setPlaceTool('select')
        clearWallDraft()
        clearStripDraft()
      }
      if (e.key === 'Tab' && e.type === 'keydown') {
        const target = e.target as HTMLElement | null
        const inField =
          target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
        if (inField) return
        if (isDrawWallTool && wallDraftStart) {
          e.preventDefault()
          setDraftFlip((f) => !f)
        } else if (selectedWall && !selectedWall.centerline) {
          e.preventDefault()
          const cur = wallEffectiveSide(selectedWall, wallSource)
          onUpdateWall(selectedWall.id, { side: cur === 1 ? -1 : 1 })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    }
  }, [
    clearWallDraft,
    clearStripDraft,
    placeTool,
    wallDraftStart,
    selectedWall,
    wallSource,
    onUpdateWall,
    isDrawWallTool,
  ])

  const polyPoints = (polygon: [number, number][]) =>
    polygon.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')

  const openingEntry = useCallback(
    (id: string, t0: number, t1: number): OpeningLayoutEntry => {
      const prev = openingLayout[id]
      return {
        t0,
        t1,
        ...(prev?.sill != null ? { sill: prev.sill } : {}),
        ...(prev?.height != null ? { height: prev.height } : {}),
        ...(prev?.wallId ? { wallId: prev.wallId } : {}),
        ...(prev?.kind ? { kind: prev.kind } : {}),
        ...(prev?.label ? { label: prev.label } : {}),
        ...(prev?.style !== undefined ? { style: prev.style } : {}),
      }
    },
    [openingLayout],
  )

  const onPointerMove = (e: React.PointerEvent) => {
    // Hover distances along a wall before placing the first click (on the face, not centerline)
    if (
      (isDrawWallTool || placeTool === 'measure') &&
      !wallDraftStart &&
      !drag
    ) {
      const world = svgToWorld(e.clientX, e.clientY)
      if (!world) return

      // Prefer centerline tips so continue-after-cancel shares the exact endpoint
      let tipBest = ENDPOINT_SNAP * 1.35
      let tipHit: {
        wallId: string
        handle: 'a' | 'b'
        tip: [number, number]
        alongA: number
        alongB: number
        wallLen: number
      } | null = null
      for (const w of wallSource) {
        if (w.glass) continue
        const wallLen = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1])
        if (wallLen < 0.05) continue
        for (const handle of ['a', 'b'] as const) {
          const tip = handle === 'a' ? w.a : w.b
          const d = Math.hypot(world.x - tip[0], world.z - tip[1])
          if (d < tipBest) {
            tipBest = d
            tipHit = {
              wallId: w.id,
              handle,
              tip: [tip[0], tip[1]],
              alongA: handle === 'a' ? 0 : wallLen,
              alongB: handle === 'a' ? wallLen : 0,
              wallLen,
            }
          }
        }
      }
      if (tipHit) {
        setHoverMeasure({
          wallId: tipHit.wallId,
          point: tipHit.tip,
          facePoint: tipHit.tip,
          t: tipHit.handle === 'a' ? 0 : 1,
          alongA: tipHit.alongA,
          alongB: tipHit.alongB,
          wallLen: tipHit.wallLen,
          mode: 'corner',
          handle: tipHit.handle,
        })
        setWallAlignGuides([
          { axis: 'x', at: tipHit.tip[0] },
          { axis: 'z', at: tipHit.tip[1] },
        ])
        if (placeTool === 'measure') return
        return
      }

      const hit = nearestWallProjection(world.x, world.z, wallSource)
      if (hit) {
        const wall = wallSource.find((w) => w.id === hit.wallId)
        // Corner only within an absolute radius of a tip (not a % of wall length),
        // so a partition 40 cm from a corner still branches off the face.
        const cornerReach = ENDPOINT_SNAP * 1.35
        const nearA = wall ? Math.hypot(world.x - wall.a[0], world.z - wall.a[1]) < cornerReach : false
        const nearB = wall ? Math.hypot(world.x - wall.b[0], world.z - wall.b[1]) < cornerReach : false
        if (nearA || nearB) {
          const handle: 'a' | 'b' = nearA ? 'a' : 'b'
          const tip: [number, number] = wall
            ? handle === 'a'
              ? [wall.a[0], wall.a[1]]
              : [wall.b[0], wall.b[1]]
            : hit.point
          setHoverMeasure({
            wallId: hit.wallId,
            point: tip,
            facePoint: tip,
            t: handle === 'a' ? 0 : 1,
            alongA: handle === 'a' ? 0 : hit.wallLen,
            alongB: handle === 'a' ? hit.wallLen : 0,
            wallLen: hit.wallLen,
            mode: 'corner',
            handle,
          })
          setWallAlignGuides([
            { axis: 'x', at: tip[0] },
            { axis: 'z', at: tip[1] },
          ])
        } else {
          const facePoint = wall
            ? wallFacePointAt(wall, hit.t, world.x, world.z, wallSource)
            : hit.point
          setHoverMeasure({
            wallId: hit.wallId,
            point: hit.point,
            facePoint,
            t: hit.t,
            alongA: hit.alongA,
            alongB: hit.alongB,
            wallLen: hit.wallLen,
            mode: 'face',
          })
          setWallAlignGuides([
            { axis: 'x', at: facePoint[0] },
            { axis: 'z', at: facePoint[1] },
          ])
        }
      } else {
        setHoverMeasure(null)
        setWallAlignGuides([])
      }
      if (placeTool === 'measure') return
    }

    if (isDrawWallTool && (wallDraftStart || wallDraftAnchor) && !drag) {
      setHoverMeasure(null)
      const world = svgToWorld(e.clientX, e.clientY)
      if (!world) return
      const anchor: DraftAnchor =
        wallDraftAnchor ??
        (wallDraftStart
          ? { kind: 'free', point: wallDraftStart }
          : { kind: 'free', point: [world.x, world.z] })
      // Provisional end for orthogonal snap relative to resolved start
      const provisionalStart = resolveDraftStart(anchor, [world.x, world.z])
      const snapped = snapWallPoint(
        world.x,
        world.z,
        wallSource,
        provisionalStart,
        e.shiftKey || shiftHeld,
      )
      const rawEnd: [number, number] = [snapped.x, snapped.z]
      const start = resolveDraftStart(anchor, rawEnd)
      const end = resolveDraftEnd(start, rawEnd)
      setWallDraftStart(start)
      setWallDraftEnd(end)
      setWallAlignGuides(snapped.guides)
      return
    }

    if (isDrawStripTool && stripDraftStart && !drag) {
      const world = svgToWorld(e.clientX, e.clientY)
      if (!world) return
      let end: [number, number] = [world.x, world.z]
      if (e.shiftKey || shiftHeld) {
        const dx = Math.abs(end[0] - stripDraftStart[0])
        const dz = Math.abs(end[1] - stripDraftStart[1])
        end =
          dx >= dz
            ? [end[0], stripDraftStart[1]]
            : [stripDraftStart[0], end[1]]
      }
      setStripDraftEnd(end)
      return
    }

    if (!drag) return

    if (drag.kind === 'view-pan') {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const dSvgX = ((e.clientX - drag.startClientX) * vbW) / rect.width
      const dSvgY = ((e.clientY - drag.startClientY) * vbH) / rect.height
      // Drag content with the cursor (grab-and-move)
      setViewPan({
        x: drag.startPanX - dSvgX,
        z: drag.startPanZ + dSvgY,
      })
      return
    }

    if (drag.kind === 'north-rotate') {
      const ang = angleFromPointer(e.clientX, e.clientY)
      if (ang != null) onNorthAngleChange(ang)
      return
    }

    if (drag.kind === 'north-move') {
      const local = svgLocal(e.clientX, e.clientY)
      if (!local) return
      const cx = local.x - drag.ox
      const cy = local.y - drag.oy
      const margin = COMPASS_R + 0.1
      const nx = Math.min(vbW - margin, Math.max(margin, cx))
      const ny = Math.min(vbH - margin - 0.25, Math.max(margin, cy))
      onCompassPosChange(nx / vbW, ny / vbH)
      return
    }

    const world = svgToWorld(e.clientX, e.clientY)
    if (!world) return

    if (drag.kind === 'furniture') {
      const item = furniture.find((f) => f.id === drag.id)
      if (!item) return
      const y = item.position[1]
      const rawX = world.x - drag.ox
      const rawZ = world.z - drag.oz
      const others = furniture.filter((f) => f.id !== drag.id)
      const snapped = snapFurnitureMove(rawX, rawZ, item.size, item.rotation, {
        walls: wallSource,
        others,
      })
      setGuides(snapped.guides)
      onMoveFurniture(drag.id, [snapped.x, y, snapped.z])
      return
    }

    if (drag.kind === 'ceiling') {
      const light = ceilingLights.find((l) => l.id === drag.id)
      if (!light) return
      onUpdateCeilingLight(drag.id, {
        position: [world.x - drag.ox, world.z - drag.oz],
      })
      return
    }

    if (drag.kind === 'wall-move') {
      const dx = world.x - drag.ox
      const dz = world.z - drag.oz
      let na: [number, number] = [drag.startA[0] + dx, drag.startA[1] + dz]
      let nb: [number, number] = [drag.startB[0] + dx, drag.startB[1] + dz]
      // Align move to nearby endpoints / axes
      const others = wallSource.filter((w) => w.id !== drag.id)
      const snapA = snapWallPoint(na[0], na[1], others, null, true)
      const offX = snapA.x - na[0]
      const offZ = snapA.z - na[1]
      if (Math.abs(offX) > 1e-9 || Math.abs(offZ) > 1e-9) {
        na = [snapA.x, snapA.z]
        nb = [nb[0] + offX, nb[1] + offZ]
        setWallAlignGuides(snapA.guides)
      } else {
        const snapB = snapWallPoint(nb[0], nb[1], others, null, true)
        const bx = snapB.x - nb[0]
        const bz = snapB.z - nb[1]
        if (Math.abs(bx) > 1e-9 || Math.abs(bz) > 1e-9) {
          nb = [snapB.x, snapB.z]
          na = [na[0] + bx, na[1] + bz]
          setWallAlignGuides(snapB.guides)
        } else {
          setWallAlignGuides([])
        }
      }
      onUpdateWall(drag.id, { a: na, b: nb })
      return
    }

    if (drag.kind === 'wall-slide') {
      const wall = wallSource.find((w) => w.id === drag.id)
      if (!wall) return
      const slid = slideInteriorWall(
        wall,
        world.x,
        world.z,
        drag.ox,
        drag.oz,
        drag.startA,
        drag.startB,
        wallSource,
        drag.dependents,
      )
      if (!slid) return
      setWallAlignGuides(slid.guides)
      setSlideDelta(slid.delta)
      onUpdateWall(drag.id, { a: slid.a, b: slid.b })
      for (const u of slid.dependentUpdates) {
        onUpdateWall(u.id, { a: u.a, b: u.b })
      }
      return
    }

    if (drag.kind === 'wall-end') {
      const wall = wallSource.find((w) => w.id === drag.id)
      if (!wall) return
      const fixed = drag.handle === 'a' ? wall.b : wall.a
      const snapped = snapWallPoint(
        world.x,
        world.z,
        wallSource.filter((w) => w.id !== drag.id),
        fixed,
        e.shiftKey || shiftHeld,
      )
      setWallAlignGuides(snapped.guides)
      if (drag.handle === 'a') onUpdateWall(drag.id, { a: [snapped.x, snapped.z] })
      else onUpdateWall(drag.id, { b: [snapped.x, snapped.z] })
      return
    }

    if (drag.kind === 'opening') {
      const wall = wallSource.find((w) => w.id === drag.wallId)
      if (!wall) return
      const [ax, az] = wall.a
      const [bx, bz] = wall.b
      const dx = bx - ax
      const dz = bz - az
      const len2 = dx * dx + dz * dz || 1
      let t = ((world.x - ax) * dx + (world.z - az) * dz) / len2
      const half = drag.span / 2
      t = Math.min(1 - half, Math.max(half, t))
      onUpdateOpening(drag.id, openingEntry(drag.id, t - half, t + half))
      return
    }

    if (drag.kind === 'opening-resize') {
      const wall = wallSource.find((w) => w.id === drag.wallId)
      if (!wall) return
      const [ax, az] = wall.a
      const [bx, bz] = wall.b
      const dx = bx - ax
      const dz = bz - az
      const length = Math.hypot(dx, dz) || 1
      const len2 = dx * dx + dz * dz || 1
      let t = ((world.x - ax) * dx + (world.z - az) * dz) / len2
      const minSpan = Math.min(0.95, MIN_OPENING_W / length)
      if (drag.handle === 'start') {
        const t1 = drag.fixedT
        const t0 = Math.min(t1 - minSpan, Math.max(0, t))
        onUpdateOpening(drag.id, openingEntry(drag.id, t0, t1))
      } else {
        const t0 = drag.fixedT
        const t1 = Math.max(t0 + minSpan, Math.min(1, t))
        onUpdateOpening(drag.id, openingEntry(drag.id, t0, t1))
      }
      return
    }

    if (drag.kind === 'partition') {
      const dx = world.x - drag.ox
      const dz = world.z - drag.oz
      onMovePartition(
        drag.id,
        [drag.startA[0] + dx, drag.startA[1] + dz],
        [drag.startB[0] + dx, drag.startB[1] + dz],
      )
      return
    }

    // resize furniture
    if (drag.kind !== 'resize') return
    const item = furniture.find((f) => f.id === drag.id)
    if (!item) return
    const { lx, lz } = worldToLocal(
      world.x - drag.startMx,
      world.z - drag.startMz,
      drag.rotation,
    )

    let w = drag.startW
    let d = drag.startD
    let cx = 0
    let cz = 0

    if (drag.handle === 'e') {
      w = Math.max(MIN_SIZE, drag.startW + lx)
      cx = (w - drag.startW) / 2
    } else if (drag.handle === 'w') {
      w = Math.max(MIN_SIZE, drag.startW - lx)
      cx = (drag.startW - w) / 2
    } else if (drag.handle === 'n') {
      d = Math.max(MIN_SIZE, drag.startD + lz)
      cz = (d - drag.startD) / 2
    } else if (drag.handle === 's') {
      d = Math.max(MIN_SIZE, drag.startD - lz)
      cz = (drag.startD - d) / 2
    }

    const delta = localToWorld(cx, cz, drag.rotation)
    onResizeFurniture(
      drag.id,
      [w, item.size[1], d],
      [drag.startX + delta.x, item.position[1], drag.startZ + delta.z],
    )
  }

  const endDrag = (e?: React.PointerEvent) => {
    if (drag && e) {
      try {
        const svg = svgRef.current
        if (svg?.hasPointerCapture?.(e.pointerId)) {
          svg.releasePointerCapture(e.pointerId)
        } else {
          ;(e.target as Element).releasePointerCapture?.(e.pointerId)
        }
      } catch {
        /* ignore */
      }
    }
    setDrag(null)
    setGuides([])
    if (drag?.kind === 'wall-end' || drag?.kind === 'wall-move' || drag?.kind === 'wall-slide') {
      setWallAlignGuides([])
      setSlideDelta(null)
    }
  }

  /** Multiply scale — wheel / pinch feel; lower scale = closer. */
  const multiplyZoom = (factor: number) => {
    setViewScale((s) =>
      Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, Number((s * factor).toFixed(4)))),
    )
  }

  const resetView = () => {
    setViewScale(1)
    setViewPan({ x: 0, z: 0 })
  }

  /** Display zoom: 100% = fit building, higher = closer. */
  const zoomPercent = Math.round(100 / scale)

  const openWallLengthEdit = useCallback(
    (wall: WallSeg, clientX: number, clientY: number) => {
      if (wall.glass || (placeTool !== 'select' && placeTool !== 'move')) return
      const [ax, az] = wall.a
      const [bx, bz] = wall.b
      const dx = bx - ax
      const dz = bz - az
      const curLen = Math.hypot(dx, dz)
      if (curLen < 1e-6) return

      const world = svgToWorld(clientX, clientY)
      let fixA = true
      if (world) {
        const da = Math.hypot(world.x - ax, world.z - az)
        const db = Math.hypot(world.x - bx, world.z - bz)
        fixA = da >= db
      }

      onSelect(wall.id)
      onDrawWallThicknessChange(wall.thickness)
      const edgeM = wallEdgeLength(wall, wallSource)
      setWallLengthEdit({
        wallId: wall.id,
        fixA,
        lengthCm: String(Math.round(edgeM * 100)),
      })
    },
    [placeTool, svgToWorld, onSelect, onDrawWallThicknessChange, wallSource],
  )

  const applyWallLengthEdit = useCallback(() => {
    if (!wallLengthEdit) return
    const wall = wallSource.find((w) => w.id === wallLengthEdit.wallId)
    if (!wall || wall.glass) {
      setWallLengthEdit(null)
      return
    }
    const cm = Number(String(wallLengthEdit.lengthCm).trim().replace(',', '.'))
    if (!Number.isFinite(cm) || cm < MIN_WALL_LEN * 100) return
    const nextOuter = Math.max(MIN_WALL_LEN, cm / 100)
    const { extA, extB } = wallCornerLengthExtensions(wall, wallSource)
    // Length edit is outer (face + corner fills); keep fills and resize the face.
    const nextLen = Math.max(MIN_WALL_LEN, nextOuter - extA - extB)
    const [ax, az] = wall.a
    const [bx, bz] = wall.b
    const dx = bx - ax
    const dz = bz - az
    const curLen = Math.hypot(dx, dz)
    if (curLen < 1e-6) {
      setWallLengthEdit(null)
      return
    }
    const ux = dx / curLen
    const uz = dz / curLen
    if (wallLengthEdit.fixA) {
      onUpdateWall(wall.id, { b: [ax + ux * nextLen, az + uz * nextLen] })
    } else {
      onUpdateWall(wall.id, { a: [bx - ux * nextLen, bz - uz * nextLen] })
    }
    setWallLengthEdit(null)
  }, [wallLengthEdit, wallSource, onUpdateWall])

  useEffect(() => {
    if (!wallLengthEdit) return
    const t = window.setTimeout(() => lengthInputRef.current?.select(), 0)
    return () => window.clearTimeout(t)
  }, [wallLengthEdit])

  return (
    <div className="plan2d">
      <div className="plan2d-chrome">
        <button
          type="button"
          className="plan2d-chrome-toggle"
          title={toolbarCollapsed ? 'Show tools' : 'Hide tools'}
          aria-expanded={!toolbarCollapsed}
          onClick={() => setToolbarCollapsed((v) => !v)}
        >
          <span className="plan2d-chrome-toggle-icon" aria-hidden>
            {toolbarCollapsed ? '▸' : '▾'}
          </span>
          Tools
        </button>
        <span className="plan2d-chrome-divider" aria-hidden />
        <span className="plan2d-chrome-mode" title="Current tool">
          {placeTool === 'french-door'
            ? 'French door'
            : placeTool === 'ceil-strip'
              ? 'LED strip'
              : placeTool === 'ceil-industrial'
                ? 'Industrial'
                : placeTool === 'ceil-globe'
                  ? 'Globe'
                  : placeTool.charAt(0).toUpperCase() + placeTool.slice(1)}
          {ceilingPlanMode ? ' · ceiling' : ''}
        </span>
        <div className="plan2d-chrome-spacer" />
        <div className="plan2d-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="plan2d-icon-btn"
            title="Zoom out"
            onClick={() => multiplyZoom(1.12)}
          >
            −
          </button>
          <button
            type="button"
            className="plan2d-zoom-label"
            title="Reset zoom & pan"
            onClick={resetView}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            className="plan2d-icon-btn"
            title="Zoom in"
            onClick={() => multiplyZoom(1 / 1.12)}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={`plan2d-chip${showFurniture2D ? ' is-on' : ''}`}
          title={
            ceilingPlanMode
              ? 'Show faint furniture under the ceiling plan'
              : 'Show or hide furniture on the plan'
          }
          onClick={() => onShowFurniture2DChange(!showFurniture2D)}
        >
          Furniture
        </button>
        <button
          type="button"
          className={`plan2d-chip${showCompass ? ' is-on' : ''}`}
          title="Show or hide the north compass"
          onClick={() => onShowCompassChange(!showCompass)}
        >
          Compass
        </button>
        <button
          type="button"
          className={`plan2d-chip${ceilingPlanMode ? ' is-on' : ''}`}
          title="Reflected ceiling plan — place LED strips and pendants"
          onClick={() => {
            setCeilingPlanMode((v) => {
              const next = !v
              if (next) {
                setPlaceTool('select')
                clearWallDraft()
                clearStripDraft()
              } else if (isPlaceCeilingTool) {
                setPlaceTool('select')
                clearStripDraft()
              }
              return next
            })
          }}
        >
          Ceiling
        </button>
      </div>

      {!toolbarCollapsed && (
      <div className="plan2d-toolbar">
        <div className="plan2d-tool-group" role="group" aria-label="Tools">
          <span className="plan2d-group-label">Tools</span>
          <div className="plan2d-seg">
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'select' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool('select')
              clearWallDraft()
            }}
          >
            Select
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'move' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool('move')
              clearWallDraft()
            }}
          >
            Move
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'slide' ? ' is-active' : ''}`}
            title="Slide interior walls along their axis to resize rooms"
            onClick={() => {
              setPlaceTool((t) => (t === 'slide' ? 'select' : 'slide'))
              clearWallDraft()
              setSlideDelta(null)
            }}
          >
            Slide
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'measure' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'measure' ? 'select' : 'measure'))
              clearWallDraft()
            }}
          >
            Measure
          </button>
          </div>
        </div>

        <div className="plan2d-tool-group" role="group" aria-label="Draw">
          <span className="plan2d-group-label">Draw</span>
          <div className="plan2d-seg">
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'wall' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'wall' ? 'select' : 'wall'))
              clearWallDraft()
              onSelect(null)
            }}
          >
            Wall
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'glass' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'glass' ? 'select' : 'glass'))
              clearWallDraft()
              onSelect(null)
            }}
          >
            Glass
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'window' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'window' ? 'select' : 'window'))
              clearWallDraft()
            }}
          >
            Window
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'door' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'door' ? 'select' : 'door'))
              clearWallDraft()
            }}
          >
            Door
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'french-door' ? ' is-active' : ''}`}
            onClick={() => {
              setPlaceTool((t) => (t === 'french-door' ? 'select' : 'french-door'))
              clearWallDraft()
            }}
          >
            French
          </button>
          <button
            type="button"
            className={`plan2d-tool${placeTool === 'gate' ? ' is-active' : ''}`}
            title="Terrace fence gate — place on a fence / wall like a door"
            onClick={() => {
              setPlaceTool((t) => (t === 'gate' ? 'select' : 'gate'))
              clearWallDraft()
            }}
          >
            Gate
          </button>
          </div>
        </div>

        {ceilingPlanMode && (
          <div className="plan2d-tool-group" role="group" aria-label="Ceiling lights">
            <span className="plan2d-group-label">Lights</span>
            <div className="plan2d-seg">
            <button
              type="button"
              className={`plan2d-tool${placeTool === 'ceil-strip' ? ' is-active' : ''}`}
              onClick={() => {
                setPlaceTool((t) => (t === 'ceil-strip' ? 'select' : 'ceil-strip'))
                clearWallDraft()
                clearStripDraft()
              }}
            >
              LED strip
            </button>
            <button
              type="button"
              className={`plan2d-tool${placeTool === 'ceil-industrial' ? ' is-active' : ''}`}
              onClick={() => {
                setPlaceTool((t) => (t === 'ceil-industrial' ? 'select' : 'ceil-industrial'))
                clearWallDraft()
                clearStripDraft()
              }}
            >
              Industrial
            </button>
            <button
              type="button"
              className={`plan2d-tool${placeTool === 'ceil-globe' ? ' is-active' : ''}`}
              title="Soft flush globe — bathroom & bedroom"
              onClick={() => {
                setPlaceTool((t) => (t === 'ceil-globe' ? 'select' : 'ceil-globe'))
                clearWallDraft()
                clearStripDraft()
              }}
            >
              Globe
            </button>
            <button
              type="button"
              className="plan2d-tool"
              disabled={!ceilingLights.some((l) => l.id === selectedId)}
              onClick={() => {
                if (selectedId && ceilingLights.some((l) => l.id === selectedId)) {
                  onRemoveCeilingLight(selectedId)
                }
              }}
            >
              Remove
            </button>
            {ceilingLights.some((l) => l.id === selectedId) && (
              <button
                type="button"
                className="plan2d-tool"
                title="Rotate selected light 90°"
                onClick={() => {
                  const light = ceilingLights.find((l) => l.id === selectedId)
                  if (!light) return
                  onUpdateCeilingLight(light.id, {
                    rotation: light.rotation + Math.PI / 2,
                  })
                }}
              >
                Rotate 90°
              </button>
            )}
            </div>
          </div>
        )}

        <div className="plan2d-tool-group" role="group" aria-label="Edit">
          <span className="plan2d-group-label">Edit</span>
          <div className="plan2d-seg">
          <button
            type="button"
            className="plan2d-tool"
            disabled={!selectedIsOpening && !selectedAnyWall}
            onClick={() => {
              if (selectedAnyWall) {
                onRemoveWall(selectedAnyWall.id)
                onSelect(null)
                return
              }
              if (!selectedId || !selectedIsOpening) return
              onRemoveOpening(selectedId)
              onSelect(null)
            }}
          >
            Remove
          </button>
          {selectedWall && (
            <button
              type="button"
              className="plan2d-tool"
              onClick={() => {
                setWallLengthEdit({
                  wallId: selectedWall.id,
                  fixA: true,
                  lengthCm: String(
                    Math.round(wallEdgeLength(selectedWall, wallSource) * 100),
                  ),
                })
              }}
            >
              Length
            </button>
          )}
          {selectedWall && !selectedWall.centerline && (
            <button
              type="button"
              className="plan2d-tool"
              title="Move the wall body to the other side of its drawn line (Tab)"
              onClick={() => {
                const cur = wallEffectiveSide(selectedWall, wallSource)
                onUpdateWall(selectedWall.id, { side: cur === 1 ? -1 : 1 })
              }}
            >
              Flip side
            </button>
          )}
          </div>
          <div className="plan2d-thick" role="group" aria-label="Wall thickness">
            <span>Thick</span>
            <div className="plan2d-thick-stepper">
              <button
                type="button"
                className="plan2d-icon-btn"
                title="Thinner (−1 cm)"
                onClick={() => {
                  const next = Math.min(
                    0.5,
                    Math.max(0.1, Number((drawWallThickness - 0.01).toFixed(2))),
                  )
                  onDrawWallThicknessChange(next)
                  if (selectedWall) onUpdateWall(selectedWall.id, { thickness: next })
                }}
              >
                −
              </button>
              <input
                type="number"
                min={5}
                max={60}
                step={1}
                title="Wall thickness in centimetres"
                value={Math.round(drawWallThickness * 100)}
                onChange={(e) => {
                  const cm = Number(e.target.value)
                  if (!Number.isFinite(cm)) return
                  const next = Math.min(0.5, Math.max(0.1, Math.round(cm) / 100))
                  onDrawWallThicknessChange(next)
                  if (selectedWall) onUpdateWall(selectedWall.id, { thickness: next })
                }}
              />
              <button
                type="button"
                className="plan2d-icon-btn"
                title="Thicker (+1 cm)"
                onClick={() => {
                  const next = Math.min(
                    0.5,
                    Math.max(0.1, Number((drawWallThickness + 0.01).toFixed(2))),
                  )
                  onDrawWallThicknessChange(next)
                  if (selectedWall) onUpdateWall(selectedWall.id, { thickness: next })
                }}
              >
                +
              </button>
            </div>
            <span>cm</span>
          </div>
        </div>

        {selectedFurniture && showFurniture2D && !ceilingPlanMode && (
          <div className="plan2d-tool-group" role="group" aria-label="Furniture">
            <span className="plan2d-group-label">Item</span>
            <button
              type="button"
              className="plan2d-tool"
              title="Switch between plain box and object icon on the plan"
              onClick={() => {
                const next =
                  (selectedFurniture.planIcon ?? 'box') === 'box' ? 'symbol' : 'box'
                onPatchFurniture(selectedFurniture.id, { planIcon: next })
              }}
            >
              {(selectedFurniture.planIcon ?? 'box') === 'box' ? 'Icon: box' : 'Icon: symbol'}
            </button>
          </div>
        )}

        {!useDefaultRooms && customRooms.length > 0 && (
          <div className="plan2d-tool-group plan2d-room-group" role="group" aria-label="Room">
            <span className="plan2d-group-label">Room</span>
            <select
              className="plan2d-room-select"
              value={customRooms.some((r) => r.id === selectedId) ? selectedId ?? '' : ''}
              onChange={(e) => onSelect(e.target.value || null)}
            >
              <option value="">Select room…</option>
              {customRooms.map((r) => {
                const kind = normalizeRoomKind(roomKinds[r.id])
                return (
                  <option key={r.id} value={r.id}>
                    {roomNames[r.id] || ROOM_KIND_LABEL[kind]}
                    {roomNames[r.id] ? ` (${ROOM_KIND_LABEL[kind]})` : ''}
                  </option>
                )
              })}
            </select>
            <input
              className="plan2d-room-name"
              type="text"
              placeholder="Name"
              disabled={!customRooms.some((r) => r.id === selectedId)}
              value={
                selectedId && customRooms.some((r) => r.id === selectedId)
                  ? roomNames[selectedId] ?? ''
                  : ''
              }
              onChange={(e) => {
                if (selectedId && customRooms.some((r) => r.id === selectedId)) {
                  onRenameRoom(selectedId, e.target.value)
                }
              }}
            />
            <select
              className="plan2d-room-kind"
              disabled={!customRooms.some((r) => r.id === selectedId)}
              value={
                selectedId && customRooms.some((r) => r.id === selectedId)
                  ? normalizeRoomKind(roomKinds[selectedId])
                  : 'room'
              }
              onChange={(e) => {
                if (selectedId && customRooms.some((r) => r.id === selectedId)) {
                  onSetRoomKind(selectedId, normalizeRoomKind(e.target.value))
                }
              }}
              title="Room type"
            >
              <option value="room">Room</option>
              <option value="bath">Bath</option>
              <option value="terrace">Terrace</option>
            </select>
            <button
              type="button"
              className="plan2d-tool"
              disabled={!customRooms.some((r) => r.id === selectedId)}
              title="Edit room type (also double-click room)"
              onClick={() => {
                if (selectedId && customRooms.some((r) => r.id === selectedId)) {
                  onEditRoom(selectedId)
                }
              }}
            >
              Type…
            </button>
            <span className="plan2d-room-count">{customRooms.length} closed</span>
          </div>
        )}
      </div>
      )}

      <div className="plan2d-hints">
        {placeTool === 'wall' && !wallDraftStart && (
          <span className="plan2d-tool-hint">
            Hover a corner to continue · mid-wall = partition (face-to-face length)
          </span>
        )}
        {placeTool === 'glass' && !wallDraftStart && (
          <span className="plan2d-tool-hint">
            Draw a glass partition (bath screen) · click start, then end
          </span>
        )}
        {isDrawWallTool && wallDraftStart && (
          <span className="plan2d-tool-hint">
            {placeTool === 'glass'
              ? 'Click end · Esc cancel'
              : 'Click end · Tab flips thickness side · Esc cancel · line = face, exact clear length'}
          </span>
        )}
        {placeTool === 'measure' && (
          <span className="plan2d-tool-hint">
            Hover walls to read distances from each corner · Esc back to Select
          </span>
        )}
        {placeTool === 'move' && (
          <span className="plan2d-tool-hint">
            Drag furniture or walls to move freely · Select tool to resize / rotate
          </span>
        )}
        {placeTool === 'slide' && (
          <span className="plan2d-tool-hint">
            Drag an interior wall along its axis to resize rooms — connected partitions stay attached
            {slideDelta != null
              ? ` · ${slideDelta >= 0 ? '+' : ''}${(slideDelta * 100).toFixed(0)} cm`
              : ''}
          </span>
        )}
        {placeTool === 'select' && selectedWall && (
          <span className="plan2d-tool-hint">
            Blue squares = resize · Length / double-click = exact cm · Tab = flip thickness side
          </span>
        )}
        {placeTool === 'select' && !selectedWall && !selectedFurniture && !selectedIsOpening && (
          <span className="plan2d-tool-hint">
            Right-drag or middle-drag to pan · Scroll to zoom
          </span>
        )}
        {isPlaceOpeningTool && (
          <span className="plan2d-tool-hint">
            Click a wall to place a{' '}
            {placeTool === 'french-door'
              ? 'French glass door'
              : placeTool === 'gate'
                ? 'gate'
                : placeTool === 'door'
                  ? 'door'
                  : 'window'}
          </span>
        )}
        {ceilingPlanMode && !isPlaceCeilingTool && (
          <span className="plan2d-tool-hint">
            Ceiling plan — draw LED strips · place Industrial or Globe · drag to move · R rotate
          </span>
        )}
        {placeTool === 'ceil-strip' && !stripDraftStart && (
          <span className="plan2d-tool-hint">
            Click strip start · then click end · Hold Shift for axis lock · Esc cancel
          </span>
        )}
        {placeTool === 'ceil-strip' && stripDraftStart && (
          <span className="plan2d-tool-hint">
            Click end to finish strip
            {stripDraftEnd
              ? ` · ${(Math.hypot(stripDraftEnd[0] - stripDraftStart[0], stripDraftEnd[1] - stripDraftStart[1]) * 100).toFixed(0)} cm`
              : ''}
          </span>
        )}
        {(placeTool === 'ceil-industrial' || placeTool === 'ceil-globe') && (
          <span className="plan2d-tool-hint">
            Click to place a{' '}
            {placeTool === 'ceil-globe' ? 'flush globe (bath / bedroom)' : 'industrial pendant'}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vbW} ${vbH}`}
        xmlns="http://www.w3.org/2000/svg"
        className={`plan2d-svg${
          drag?.kind === 'view-pan'
            ? ' is-panning'
            : isDrawWallTool ||
                isPlaceOpeningTool ||
                isPlaceCeilingTool ||
                placeTool === 'measure'
              ? ' is-placing'
              : placeTool === 'move' || placeTool === 'slide'
                ? ' is-moving'
                : ''
        }`}
        role="img"
        aria-label={ceilingPlanMode ? 'Ceiling plan' : 'Monochrome floor plan'}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={(e) => {
          endDrag(e)
          setHoverMeasure(null)
        }}
        onWheel={(e) => {
          e.preventDefault()
          // Multiplicative zoom so close-in steps stay useful; lower scale = closer
          const steps = Math.min(6, Math.max(1, Math.round(Math.abs(e.deltaY) / 40)))
          const factor = e.deltaY > 0 ? 1.1 ** steps : (1 / 1.1) ** steps
          multiplyZoom(factor)
        }}
        onContextMenu={(e) => {
          // Right-drag pans; suppress the browser menu on the plan
          e.preventDefault()
        }}
        onPointerDownCapture={(e) => {
          // Right or middle button: pan (capture so it wins over walls/furniture)
          if (e.button !== 2 && e.button !== 1) return
          e.preventDefault()
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag({
            kind: 'view-pan',
            startClientX: e.clientX,
            startClientY: e.clientY,
            startPanX: viewPan.x,
            startPanZ: viewPan.z,
          })
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if (placeTool === 'measure') {
            e.stopPropagation()
            return
          }
          if (isPlaceCeilingTool) {
            const world = svgToWorld(e.clientX, e.clientY)
            if (!world) return
            e.stopPropagation()
            if (placeTool === 'ceil-strip') {
              if (!stripDraftStart) {
                setStripDraftStart([world.x, world.z])
                setStripDraftEnd([world.x, world.z])
                return
              }
              commitStripDraft([world.x, world.z])
              return
            }
            const kind: CeilingLightKind =
              placeTool === 'ceil-globe' ? 'globe' : 'industrial'
            onAddCeilingLight(makeCeilingLight(kind, world.x, world.z))
            setPlaceTool('select')
            return
          }
          if (isDrawWallTool) {
            const world = svgToWorld(e.clientX, e.clientY)
            if (!world) return
            if (!wallDraftStart && !wallDraftAnchor) {
              if (hoverMeasure?.mode === 'corner' && hoverMeasure.handle) {
                startWallFromCorner(hoverMeasure.wallId, hoverMeasure.handle)
                setWallAlignGuides([
                  { axis: 'x', at: hoverMeasure.point[0] },
                  { axis: 'z', at: hoverMeasure.point[1] },
                ])
                return
              }
              if (hoverMeasure?.mode === 'face') {
                startWallFromFace(
                  hoverMeasure.wallId,
                  hoverMeasure.t,
                  hoverMeasure.facePoint,
                )
                setWallAlignGuides([
                  { axis: 'x', at: hoverMeasure.facePoint[0] },
                  { axis: 'z', at: hoverMeasure.facePoint[1] },
                ])
                return
              }
              // Fallback: snap to nearest centerline tip if close
              let tipBest = ENDPOINT_SNAP * 1.35
              let tipWall: { id: string; handle: 'a' | 'b' } | null = null
              for (const w of wallSource) {
                if (w.glass) continue
                for (const handle of ['a', 'b'] as const) {
                  const tip = handle === 'a' ? w.a : w.b
                  const d = Math.hypot(world.x - tip[0], world.z - tip[1])
                  if (d < tipBest) {
                    tipBest = d
                    tipWall = { id: w.id, handle }
                  }
                }
              }
              if (tipWall) {
                startWallFromCorner(tipWall.id, tipWall.handle)
                return
              }
              const snapped = snapWallPoint(
                world.x,
                world.z,
                wallSource,
                null,
                e.shiftKey || shiftHeld,
              )
              setWallAlignGuides(snapped.guides)
              const startPt: [number, number] = [snapped.x, snapped.z]
              setWallDraftAnchor({ kind: 'free', point: startPt })
              setWallDraftStart(startPt)
              setWallDraftEnd(startPt)
              setHoverMeasure(null)
              return
            }
            const anchor: DraftAnchor =
              wallDraftAnchor ??
              (wallDraftStart
                ? { kind: 'free', point: wallDraftStart }
                : { kind: 'free', point: [world.x, world.z] })
            const provisionalStart = resolveDraftStart(anchor, [world.x, world.z])
            const snapped = snapWallPoint(
              world.x,
              world.z,
              wallSource,
              provisionalStart,
              e.shiftKey || shiftHeld,
            )
            setWallAlignGuides(snapped.guides)
            setHoverMeasure(null)
            commitWallDraft([snapped.x, snapped.z])
            return
          }
          if (e.target === svgRef.current || (e.target as Element).tagName === 'rect') {
            const tag = (e.target as Element).getAttribute?.('data-bg')
            if (tag === 'bg' || e.target === svgRef.current) {
              onSelect(null)
              if (
                isPlaceOpeningTool ||
                placeTool === 'measure'
              ) {
                setPlaceTool('select')
              }
              setWallAlignGuides([])
              setHoverMeasure(null)
            }
          }
        }}
      >
        <rect
          data-bg="bg"
          x={0}
          y={0}
          width={vbW}
          height={vbH}
          fill="#fff"
          onPointerDown={() => {
            if (isDrawWallTool || placeTool === 'measure') return
            onSelect(null)
            if (isPlaceOpeningTool) setPlaceTool('select')
            setHoverMeasure(null)
          }}
        />

        {useDefaultRooms &&
          ROOMS.map((room) => (
            <polygon
              key={room.id}
              points={polyPoints(room.polygon)}
              fill="#f5f5f5"
              stroke="none"
            />
          ))}

        {/* Outer-corner fills: bodies outside a turn meet at the inner corner, fill the notch */}
        {cornerFills.map((f, i) => (
          <polygon
            key={`cf-${i}`}
            points={polyPoints(f.corners)}
            fill={f.exterior ? '#222' : '#444'}
            pointerEvents={isDrawWallTool || placeTool === 'measure' ? 'none' : 'auto'}
            onPointerDown={(e) => {
              if (placeTool !== 'select' && placeTool !== 'move') return
              e.stopPropagation()
              onSelect(f.wallIds[0])
            }}
          />
        ))}

        {walls.map((wall) => {
          const thick = Math.max(wall.thickness, wall.glass ? 0.06 : wall.thickness)
          const [ax, az] = wall.a
          const [bx, bz] = wall.b
          const dx = bx - ax
          const dz = bz - az
          const len = Math.hypot(dx, dz) || 1
          const footprint = wall.glass
            ? ([
                [
                  ax + (-dz / len) * (thick / 2),
                  az + (dx / len) * (thick / 2),
                ],
                [
                  bx + (-dz / len) * (thick / 2),
                  bz + (dx / len) * (thick / 2),
                ],
                [
                  bx - (-dz / len) * (thick / 2),
                  bz - (dx / len) * (thick / 2),
                ],
                [
                  ax - (-dz / len) * (thick / 2),
                  az - (dx / len) * (thick / 2),
                ],
              ] as [number, number][])
            : wallFootprintCorners(wall, wallSource)
          const pts = footprint
          const selected = selectedId === wall.id
          const edgeLen = wallEdgeLength(wall, wallSource)
          const midX = (ax + bx) / 2
          const midZ = (az + bz) / 2
          const canSlide = !wall.glass && isInteriorPartition(wall, wallSource)
          const isFence = fenceWallIds.has(wall.id)
          const solidColor = selected
            ? '#3b3b3b'
            : placeTool === 'slide' && canSlide
              ? '#1d4ed8'
              : isFence
                ? '#8a7a62'
                : wall.exterior
                  ? '#222'
                  : '#444'
          const { ix, iz } = wallInwardNormal(wall, wallSource)
          // Place length labels clear of the wall body, outside the building for envelope walls.
          const toOuterFace = wall.centerline ? thick / 2 : 0
          const isEnvelope = (() => {
            if (wall.glass || canSlide) return false
            // Built-in apartment: trust the exterior flag on centerline walls.
            if (wall.centerline) return wall.exterior === true
            // Custom plans: outer face sits on the solid building AABB (not the zoomed canvas).
            const ox = midX - ix * toOuterFace
            const oz = midZ - iz * toOuterFace
            const tol = Math.max(0.12, thick * 0.6)
            const minX = building.minX
            const minZ = building.minZ
            const maxX = building.minX + building.w
            const maxZ = building.minZ + building.d
            return (
              Math.abs(ox - minX) < tol ||
              Math.abs(ox - maxX) < tol ||
              Math.abs(oz - minZ) < tol ||
              Math.abs(oz - maxZ) < tol
            )
          })()
          const labelOff = toOuterFace + (isEnvelope ? 0.42 : 0.16)
          const labelNx = -ix * labelOff
          const labelNz = -iz * labelOff
          const dxw = bx - ax
          const dzw = bz - az
          const slideCursor =
            Math.abs(dxw) < 0.08 ? ('ew-resize' as const) : ('ns-resize' as const)
          const cursorStyle =
            placeTool === 'slide' && canSlide
              ? { cursor: slideCursor }
              : placeTool === 'move' && !wall.glass
                ? { cursor: 'move' as const }
                : wall.glass
                  ? { cursor: 'grab' as const }
                  : isPlaceOpeningTool ||
                      isDrawWallTool ||
                      placeTool === 'measure'
                    ? { cursor: 'crosshair' as const }
                    : { cursor: 'pointer' as const }

          const onWallPointerDown = wall.glass
            ? (e: React.PointerEvent) => {
                if (isDrawWallTool || placeTool === 'measure') return
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                onSelect(wall.id)
                const world = svgToWorld(e.clientX, e.clientY)
                if (!world) return
                if (placeTool === 'move' || placeTool === 'select') {
                  setDrag({
                    kind: 'partition',
                    id: wall.id,
                    ox: world.x,
                    oz: world.z,
                    startA: [ax, az],
                    startB: [bx, bz],
                  })
                }
              }
            : isPlaceOpeningTool
              ? (e: React.PointerEvent) => {
                  e.stopPropagation()
                  placeOpeningOnWall(wall.id, e.clientX, e.clientY)
                }
              : isDrawWallTool || placeTool === 'measure'
                ? undefined
                : placeTool === 'slide'
                  ? (e: React.PointerEvent) => {
                      e.stopPropagation()
                      if (!isInteriorPartition(wall, wallSource)) {
                        onSelect(wall.id)
                        return
                      }
                      e.currentTarget.setPointerCapture(e.pointerId)
                      onSelect(wall.id)
                      onDrawWallThicknessChange(wall.thickness)
                      const world = svgToWorld(e.clientX, e.clientY)
                      if (!world) return
                      setSlideDelta(0)
                      setDrag({
                        kind: 'wall-slide',
                        id: wall.id,
                        ox: world.x,
                        oz: world.z,
                        startA: [ax, az],
                        startB: [bx, bz],
                        dependents: findSlideDependents(wall, wallSource),
                      })
                    }
                : placeTool === 'move'
                  ? (e: React.PointerEvent) => {
                      e.stopPropagation()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      onSelect(wall.id)
                      onDrawWallThicknessChange(wall.thickness)
                      const world = svgToWorld(e.clientX, e.clientY)
                      if (!world) return
                      setDrag({
                        kind: 'wall-move',
                        id: wall.id,
                        ox: world.x,
                        oz: world.z,
                        startA: [ax, az],
                        startB: [bx, bz],
                      })
                    }
                  : (e: React.PointerEvent) => {
                      e.stopPropagation()
                      onSelect(wall.id)
                      onDrawWallThicknessChange(wall.thickness)

                      const now = performance.now()
                      const prev = lastWallClickRef.current
                      if (
                        prev &&
                        prev.id === wall.id &&
                        now - prev.at < 400 &&
                        Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 12
                      ) {
                        lastWallClickRef.current = null
                        openWallLengthEdit(wall, e.clientX, e.clientY)
                        return
                      }
                      lastWallClickRef.current = {
                        id: wall.id,
                        at: now,
                        x: e.clientX,
                        y: e.clientY,
                      }
                    }

          const titleText = wall.glass
            ? `${wall.label} · drag to move`
            : isPlaceOpeningTool
              ? `Place ${placeTool} on ${wall.label}`
              : placeTool === 'slide'
                ? canSlide
                  ? `${wall.label} · drag along axis to resize rooms`
                  : `${wall.label} · outer walls can't slide (use Move)`
                : placeTool === 'move'
                  ? `${wall.label} · drag to move`
                  : `${wall.label} · ${(edgeLen * 100).toFixed(0)} cm · double-click for exact length`

          return (
            <g key={wall.id}>
              {wall.glass ? (
                <polygon
                  points={pts.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                  fill={selected ? '#93c5fd' : '#c5e0f0'}
                  stroke={selected ? '#1d4ed8' : '#5a9bb8'}
                  strokeWidth={selected ? 0.045 : 0.03}
                  opacity={0.9}
                  style={{
                    ...cursorStyle,
                    pointerEvents:
                      isDrawWallTool || placeTool === 'measure' ? 'none' : 'auto',
                  }}
                  onPointerDown={onWallPointerDown}
                >
                  <title>{titleText}</title>
                </polygon>
              ) : (
                <>
                  {/* Square-ended wall body */}
                  <polygon
                    points={pts.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                    fill={isFence ? (selected ? '#a89878' : '#c4b49a') : solidColor}
                    stroke={
                      selected ? '#1d4ed8' : isFence ? '#8a7a62' : 'none'
                    }
                    strokeWidth={selected ? 0.035 : isFence ? 0.025 : 0}
                    strokeDasharray={isFence && !selected ? '0.08 0.05' : undefined}
                    opacity={isFence ? 0.85 : 1}
                    style={{
                      ...cursorStyle,
                      // Let draw/measure clicks pass through; green tips stay interactive
                      pointerEvents:
                        isDrawWallTool || placeTool === 'measure' ? 'none' : 'auto',
                    }}
                    onPointerDown={onWallPointerDown}
                    onDoubleClick={(e) => {
                      if (placeTool !== 'select') return
                      e.stopPropagation()
                      e.preventDefault()
                      openWallLengthEdit(wall, e.clientX, e.clientY)
                    }}
                  >
                    <title>
                      {isFence ? `${wall.label} · terrace fence · ` : ''}
                      {titleText}
                    </title>
                  </polygon>
                  {selected && placeTool === 'select' && (
                    <polygon
                      points={pts.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth={0.04}
                      opacity={0.45}
                      pointerEvents="none"
                    />
                  )}
                </>
              )}

              {selected && !wall.glass && !showWallLengths && placeTool === 'select' && (
                <text
                  x={tx(midX + labelNx)}
                  y={ty(midZ + labelNz)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1d4ed8"
                  fontSize={0.18}
                  fontFamily="Segoe UI, Helvetica, sans-serif"
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {`${(edgeLen * 100).toFixed(0)} cm`}
                </text>
              )}

              {showWallLengths && !wall.glass && edgeLen > 0.05 && (
                <text
                  x={tx(midX + labelNx)}
                  y={ty(midZ + labelNz)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#1e3a8a"
                  fontSize={0.17}
                  fontFamily="Segoe UI, Helvetica, sans-serif"
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {`${(edgeLen * 100).toFixed(0)} cm`}
                </text>
              )}

              {!wall.glass &&
                (
                  [
                    { handle: 'a' as const, x: ax, z: az },
                    { handle: 'b' as const, x: bx, z: bz },
                  ] as const
                ).map((h) => {
                  const showContinue = placeTool === 'wall'
                  const showResize = selected && placeTool === 'select'
                  if (!showContinue && !showResize) return null
                  return (
                    <g key={h.handle}>
                      {showContinue && (
                        <rect
                          x={tx(h.x) - WALL_HANDLE / 2}
                          y={ty(h.z) - WALL_HANDLE / 2}
                          width={WALL_HANDLE}
                          height={WALL_HANDLE}
                          fill="#16a34a"
                          stroke="#fff"
                          strokeWidth={0.03}
                          style={{ cursor: 'crosshair' }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            if (wallDraftStart || wallDraftAnchor) {
                              // Mid-draft: this corner is the END — close onto the tip
                              commitWallDraft([h.x, h.z])
                              return
                            }
                            onDrawWallThicknessChange(wall.thickness)
                            startWallFromCorner(wall.id, h.handle)
                          }}
                        >
                          <title>New wall from this corner</title>
                        </rect>
                      )}
                      {showResize && (
                        <rect
                          x={tx(h.x) - WALL_HANDLE / 2}
                          y={ty(h.z) - WALL_HANDLE / 2}
                          width={WALL_HANDLE}
                          height={WALL_HANDLE}
                          fill="#1d4ed8"
                          stroke="#fff"
                          strokeWidth={0.025}
                          style={{ cursor: 'nwse-resize' }}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            e.currentTarget.setPointerCapture(e.pointerId)
                            onSelect(wall.id)
                            setWallDraftStart(null)
                            setWallDraftEnd(null)
                            setWallDraftAnchor(null)
                            setWallAlignGuides([])
                            setDrag({ kind: 'wall-end', id: wall.id, handle: h.handle })
                          }}
                        >
                          <title>Drag to resize wall</title>
                        </rect>
                      )}
                    </g>
                  )
                })}
            </g>
          )
        })}

        {guides.map((g, i) =>
          g.axis === 'x' ? (
            <line
              key={`gx-${i}`}
              x1={tx(g.at)}
              y1={0}
              x2={tx(g.at)}
              y2={vbH}
              stroke="#ef4444"
              strokeWidth={0.025}
              strokeDasharray="0.12 0.08"
              pointerEvents="none"
            />
          ) : (
            <line
              key={`gz-${i}`}
              x1={0}
              y1={ty(g.at)}
              x2={vbW}
              y2={ty(g.at)}
              stroke="#ef4444"
              strokeWidth={0.025}
              strokeDasharray="0.12 0.08"
              pointerEvents="none"
            />
          ),
        )}

        {wallAlignGuides.map((g, i) =>
          g.axis === 'x' ? (
            <line
              key={`wax-${i}-${g.at}`}
              x1={tx(g.at)}
              y1={0}
              x2={tx(g.at)}
              y2={vbH}
              stroke="#94a3b8"
              strokeWidth={0.02}
              strokeDasharray="0.08 0.1"
              pointerEvents="none"
            />
          ) : (
            <line
              key={`waz-${i}-${g.at}`}
              x1={0}
              y1={ty(g.at)}
              x2={vbW}
              y2={ty(g.at)}
              stroke="#94a3b8"
              strokeWidth={0.02}
              strokeDasharray="0.08 0.1"
              pointerEvents="none"
            />
          ),
        )}

        {hoverMeasure && !wallDraftStart && (
          <g pointerEvents="none">
            {(() => {
              const wall = wallSource.find((w) => w.id === hoverMeasure.wallId)
              if (!wall) return null
              const [ax, az] = wall.a
              const [bx, bz] = wall.b
              const [hx, hz] = hoverMeasure.facePoint
              const dx = bx - ax
              const dz = bz - az
              const len = Math.hypot(dx, dz) || 1
              const ox = (-dz / len) * (wall.thickness / 2 + 0.18)
              const oz = (dx / len) * (wall.thickness / 2 + 0.18)

              if (hoverMeasure.mode === 'corner') {
                return (
                  <>
                    <rect
                      x={tx(hx) - 0.1}
                      y={ty(hz) - 0.1}
                      width={0.2}
                      height={0.2}
                      fill="#16a34a"
                      stroke="#fff"
                      strokeWidth={0.03}
                    />
                    <text
                      x={tx(hx + ox)}
                      y={ty(hz + oz)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#15803d"
                      fontSize={0.16}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      Continue
                    </text>
                  </>
                )
              }

              const midA: [number, number] = [(ax + hx) / 2, (az + hz) / 2]
              const midB: [number, number] = [(bx + hx) / 2, (bz + hz) / 2]
              return (
                <>
                  <circle cx={tx(hx)} cy={ty(hz)} r={0.08} fill="#ea580c" />
                  <line
                    x1={tx(ax)}
                    y1={ty(az)}
                    x2={tx(hx)}
                    y2={ty(hz)}
                    stroke="#ea580c"
                    strokeWidth={0.04}
                  />
                  <line
                    x1={tx(hx)}
                    y1={ty(hz)}
                    x2={tx(bx)}
                    y2={ty(bz)}
                    stroke="#c2410c"
                    strokeWidth={0.04}
                  />
                  {hoverMeasure.alongA > 0.02 && (
                    <text
                      x={tx(midA[0] + ox)}
                      y={ty(midA[1] + oz)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9a3412"
                      fontSize={0.18}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(hoverMeasure.alongA * 100).toFixed(0)} cm`}
                    </text>
                  )}
                  {hoverMeasure.alongB > 0.02 && (
                    <text
                      x={tx(midB[0] + ox)}
                      y={ty(midB[1] + oz)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9a3412"
                      fontSize={0.18}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(hoverMeasure.alongB * 100).toFixed(0)} cm`}
                    </text>
                  )}
                </>
              )
            })()}
          </g>
        )}

        {wallDraftStart && wallDraftEnd && (
          <g pointerEvents="none">
            {(() => {
              const draftSeg: WallSeg = {
                id: '__draft__',
                label: 'draft',
                a: wallDraftStart,
                b: wallDraftEnd,
                thickness: drawWallThickness,
                exterior: true,
                // Preview matches commit: drawn line is a face, body on draftSide
                side: draftSide(wallDraftStart),
              }
              const draftPts = wallFootprintCorners(draftSeg, [
                ...wallSource,
                draftSeg,
              ])
              const edgeLen = draftEdgeLength(wallDraftStart, wallDraftEnd)
              const mx = (wallDraftStart[0] + wallDraftEnd[0]) / 2
              const mz = (wallDraftStart[1] + wallDraftEnd[1]) / 2
              const dx = wallDraftEnd[0] - wallDraftStart[0]
              const dz = wallDraftEnd[1] - wallDraftStart[1]
              const axisAligned = Math.abs(dx) < 1e-4 || Math.abs(dz) < 1e-4
              return (
                <>
                  {draftPts.length === 4 && (
                    <polygon
                      points={draftPts.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                      fill="#93c5fd"
                      opacity={0.45}
                      stroke="#1d4ed8"
                      strokeWidth={0.04}
                    />
                  )}
                  <line
                    x1={tx(wallDraftStart[0])}
                    y1={ty(wallDraftStart[1])}
                    x2={tx(wallDraftEnd[0])}
                    y2={ty(wallDraftEnd[1])}
                    stroke="#1d4ed8"
                    strokeWidth={0.04}
                    strokeDasharray="0.12 0.08"
                  />
                  <rect
                    x={tx(wallDraftStart[0]) - 0.06}
                    y={ty(wallDraftStart[1]) - 0.06}
                    width={0.12}
                    height={0.12}
                    fill="#1d4ed8"
                  />
                  <rect
                    x={tx(wallDraftEnd[0]) - 0.06}
                    y={ty(wallDraftEnd[1]) - 0.06}
                    width={0.12}
                    height={0.12}
                    fill="#1d4ed8"
                  />
                  <text
                    x={tx(mx)}
                    y={ty(mz) - 0.22}
                    textAnchor="middle"
                    fill="#1d4ed8"
                    fontSize={0.2}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={700}
                  >
                    {`${(edgeLen * 100).toFixed(0)} cm`}
                  </text>
                  {axisAligned && edgeLen > 0.05 && (
                    <text
                      x={tx(mx)}
                      y={ty(mz) + 0.26}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize={0.14}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                    >
                      {Math.abs(dx) >= Math.abs(dz)
                        ? `Δx ${(Math.abs(dx) * 100).toFixed(0)} cm`
                        : `Δz ${(Math.abs(dz) * 100).toFixed(0)} cm`}
                    </text>
                  )}
                </>
              )
            })()}
            {draftRefs.map((ref) => {
              const wall = wallSource.find((w) => w.id === ref.wallId)
              if (!wall) return null
              const [ax, az] = wall.a
              const [bx, bz] = wall.b
              const hx = ref.hit[0]
              const hz = ref.hit[1]
              const midA: [number, number] = [(ax + hx) / 2, (az + hz) / 2]
              const midB: [number, number] = [(bx + hx) / 2, (bz + hz) / 2]
              const nx = -(bz - az)
              const nz = bx - ax
              const nlen = Math.hypot(nx, nz) || 1
              const ox = (nx / nlen) * 0.22
              const oz = (nz / nlen) * 0.22
              return (
                <g key={`ref-${ref.wallId}`}>
                  <circle cx={tx(hx)} cy={ty(hz)} r={0.07} fill="#ea580c" />
                  <line
                    x1={tx(ax)}
                    y1={ty(az)}
                    x2={tx(hx)}
                    y2={ty(hz)}
                    stroke="#ea580c"
                    strokeWidth={0.035}
                    strokeDasharray="0.08 0.06"
                  />
                  <line
                    x1={tx(hx)}
                    y1={ty(hz)}
                    x2={tx(bx)}
                    y2={ty(bz)}
                    stroke="#c2410c"
                    strokeWidth={0.035}
                    strokeDasharray="0.08 0.06"
                  />
                  {ref.alongA > 0.05 && (
                    <text
                      x={tx(midA[0] + ox)}
                      y={ty(midA[1] + oz)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9a3412"
                      fontSize={0.16}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(ref.alongA * 100).toFixed(0)} cm`}
                    </text>
                  )}
                  {ref.alongB > 0.05 && (
                    <text
                      x={tx(midB[0] + ox)}
                      y={ty(midB[1] + oz)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9a3412"
                      fontSize={0.16}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(ref.alongB * 100).toFixed(0)} cm`}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )}

        {stripDraftStart && stripDraftEnd && (
          <g pointerEvents="none">
            {(() => {
              const dx = stripDraftEnd[0] - stripDraftStart[0]
              const dz = stripDraftEnd[1] - stripDraftStart[1]
              const len = Math.hypot(dx, dz)
              const midX = (stripDraftStart[0] + stripDraftEnd[0]) / 2
              const midZ = (stripDraftStart[1] + stripDraftEnd[1]) / 2
              const width = 0.07
              const ang = Math.atan2(-dz, dx)
              const c = Math.cos(ang)
              const s = Math.sin(ang)
              const corners = (
                [
                  [-len / 2, -width / 2],
                  [len / 2, -width / 2],
                  [len / 2, width / 2],
                  [-len / 2, width / 2],
                ] as [number, number][]
              ).map(([lx, lz]) => [midX + lx * c + lz * s, midZ - lx * s + lz * c])
              return (
                <>
                  <line
                    x1={tx(stripDraftStart[0])}
                    y1={ty(stripDraftStart[1])}
                    x2={tx(stripDraftEnd[0])}
                    y2={ty(stripDraftEnd[1])}
                    stroke="#d97706"
                    strokeWidth={0.04}
                    strokeDasharray="0.1 0.06"
                  />
                  <polygon
                    points={corners.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                    fill="rgba(253,230,138,0.55)"
                    stroke="#d97706"
                    strokeWidth={0.03}
                  />
                  {len > 0.05 && (
                    <text
                      x={tx(midX)}
                      y={ty(midZ) - 0.2}
                      textAnchor="middle"
                      fill="#92400e"
                      fontSize={0.17}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(len * 100).toFixed(0)} cm`}
                    </text>
                  )}
                </>
              )
            })()}
          </g>
        )}

        {walls.flatMap((wall) =>
          (wall.openings ?? []).map((o) => {
            const [ax, az] = wall.a
            const [bx, bz] = wall.b
            const dx = bx - ax
            const dz = bz - az
            const x0 = ax + dx * o.t0
            const z0 = az + dz * o.t0
            const x1 = ax + dx * o.t1
            const z1 = az + dz * o.t1
            const len = Math.hypot(dx, dz) || 1
            const widthM = (o.t1 - o.t0) * len
            const midX = (x0 + x1) / 2
            const midZ = (z0 + z1) / 2
            const nx = (-dz / len) * (wall.thickness * 0.7)
            const nz = (dx / len) * (wall.thickness * 0.7)
            const pts = [
              [x0 + nx, z0 + nz],
              [x1 + nx, z1 + nz],
              [x1 - nx, z1 - nz],
              [x0 - nx, z0 - nz],
            ]
            const selected = selectedId === o.id
            // Cursor follows wall direction in screen space (y flips with plan)
            const wallAngle = Math.atan2(-dz, dx)
            const resizeCursor =
              Math.abs(Math.cos(wallAngle)) > Math.abs(Math.sin(wallAngle))
                ? 'ew-resize'
                : 'ns-resize'

            return (
              <g key={o.id}>
                <polygon
                  points={pts.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                  fill={
                    selected
                      ? '#c7d7ff'
                      : o.style === 'gate'
                        ? '#e8e0d4'
                        : '#fff'
                  }
                  stroke={
                    o.style === 'gate'
                      ? '#8a7a62'
                      : o.kind === 'door'
                        ? '#2563eb'
                        : '#64748b'
                  }
                  strokeWidth={selected ? 0.04 : 0.025}
                  strokeDasharray={o.style === 'gate' ? '0.06 0.04' : undefined}
                  style={{
                    cursor:
                      isDrawWallTool || placeTool === 'measure'
                        ? 'crosshair'
                        : 'grab',
                    pointerEvents:
                      isDrawWallTool || placeTool === 'measure' ? 'none' : 'auto',
                  }}
                  onPointerDown={(e) => {
                    if (
                      isDrawWallTool ||
                      placeTool === 'measure' ||
                      isPlaceOpeningTool
                    ) {
                      return
                    }
                    e.stopPropagation()
                    e.currentTarget.setPointerCapture(e.pointerId)
                    onSelect(o.id)
                    setDrag({
                      kind: 'opening',
                      id: o.id,
                      wallId: wall.id,
                      span: o.t1 - o.t0,
                    })
                  }}
                  onDoubleClick={(e) => {
                    if (placeTool !== 'select' && placeTool !== 'move') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(o.id)
                    onEditOpening(o.id)
                  }}
                >
                  <title>
                    {o.label} · {(widthM * 100).toFixed(0)} cm · double-click size
                  </title>
                </polygon>

                {selected && (
                  <>
                    <text
                      x={tx(midX + nx * 1.6)}
                      y={ty(midZ + nz * 1.6)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#1d4ed8"
                      fontSize={0.16}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={600}
                      pointerEvents="none"
                    >
                      {`${(widthM * 100).toFixed(0)} cm`}
                    </text>
                    {(
                      [
                        { handle: 'start' as const, x: x0, z: z0, fixedT: o.t1 },
                        { handle: 'end' as const, x: x1, z: z1, fixedT: o.t0 },
                      ] as const
                    ).map((h) => (
                      <rect
                        key={h.handle}
                        x={tx(h.x) - OPEN_HANDLE / 2}
                        y={ty(h.z) - OPEN_HANDLE / 2}
                        width={OPEN_HANDLE}
                        height={OPEN_HANDLE}
                        fill="#1d4ed8"
                        stroke="#fff"
                        strokeWidth={0.02}
                        style={{ cursor: resizeCursor }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          onSelect(o.id)
                          setDrag({
                            kind: 'opening-resize',
                            id: o.id,
                            wallId: wall.id,
                            handle: h.handle,
                            fixedT: h.fixedT,
                          })
                        }}
                      />
                    ))}
                  </>
                )}
              </g>
            )
          }),
        )}

        {!useDefaultRooms &&
          customRooms.map((room) => {
            // Hit area = clear floor only, so the surrounding wall bodies stay clickable
            const { inner } = room
            const selected = selectedId === room.id
            const kind = normalizeRoomKind(roomKinds[room.id])
            const fill = selected
              ? 'rgba(37, 99, 235, 0.16)'
              : kind === 'bath'
                ? 'rgba(56, 189, 248, 0.14)'
                : kind === 'terrace'
                  ? 'rgba(180, 140, 80, 0.16)'
                  : 'rgba(148, 163, 184, 0.08)'
            return (
              <g key={`fill-${room.id}`}>
                <rect
                  x={tx(inner.minX)}
                  y={ty(inner.minZ + inner.d)}
                  width={inner.w}
                  height={inner.d}
                  fill={fill}
                  stroke={selected ? '#2563eb' : 'none'}
                  strokeWidth={0.03}
                  style={{
                    cursor:
                      placeTool === 'select' || placeTool === 'move'
                        ? 'pointer'
                        : 'default',
                    pointerEvents:
                      placeTool === 'select' || placeTool === 'move' ? 'auto' : 'none',
                  }}
                  onPointerDown={(e) => {
                    if (placeTool !== 'select' && placeTool !== 'move') return
                    e.stopPropagation()
                    onSelect(room.id)
                    setPlaceTool('select')
                  }}
                  onDoubleClick={(e) => {
                    if (placeTool !== 'select' && placeTool !== 'move') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(room.id)
                    onEditRoom(room.id)
                  }}
                >
                  <title>Double-click to set room type (Room / Bath / Terrace)</title>
                </rect>
              </g>
            )
          })}

        {/* Furniture above room fills; labels render after so names stay readable.
            In ceiling mode, draw faintly (non-interactive) as context under lights. */}
        {showFurniture2D &&
          furniture.map((item) => {
          const [w, , d] = item.size
          const [px, , pz] = item.position
          const c = Math.cos(item.rotation)
          const s = Math.sin(item.rotation)
          const corners: [number, number][] = [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, d / 2],
            [-w / 2, d / 2],
          ].map(([lx, lz]) => [px + lx * c + lz * s, pz - lx * s + lz * c])
          const selected = selectedId === item.id
          const useSymbol = (item.planIcon ?? 'box') === 'symbol'
          const fill = selected ? '#93c5fd' : '#ddd'
          const stroke = selected ? '#1d4ed8' : '#333'
          const ghost = ceilingPlanMode

          const handleWorld = (lx: number, lz: number) => {
            const p = localToWorld(lx, lz, item.rotation)
            return { x: px + p.x, z: pz + p.z }
          }

          const handles: { id: ResizeHandle; lx: number; lz: number; cursor: string }[] = [
            { id: 'e', lx: w / 2, lz: 0, cursor: 'ew-resize' },
            { id: 'w', lx: -w / 2, lz: 0, cursor: 'ew-resize' },
            { id: 'n', lx: 0, lz: d / 2, cursor: 'ns-resize' },
            { id: 's', lx: 0, lz: -d / 2, cursor: 'ns-resize' },
          ]

          const interactionStyle = {
            cursor:
              ghost
                ? ('default' as const)
                : placeTool === 'move' || placeTool === 'select'
                  ? drag?.kind === 'furniture' && drag.id === item.id
                    ? ('grabbing' as const)
                    : ('grab' as const)
                  : ('default' as const),
            pointerEvents:
              ghost ||
              isDrawWallTool ||
              placeTool === 'measure' ||
              isPlaceOpeningTool ||
              isPlaceCeilingTool
                ? ('none' as const)
                : ('auto' as const),
          }

          const onFurniturePointerDown = (e: React.PointerEvent) => {
            if (ghost) return
            if (placeTool !== 'select' && placeTool !== 'move') return
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            onSelect(item.id)
            const world = svgToWorld(e.clientX, e.clientY)
            if (!world) return
            setDrag({
              kind: 'furniture',
              id: item.id,
              ox: world.x - px,
              oz: world.z - pz,
            })
          }

          return (
            <g key={item.id} opacity={ghost ? 0.22 : 1}>
              {useSymbol ? (
                <g
                  transform={`translate(${tx(px)}, ${ty(pz)}) rotate(${(-item.rotation * 180) / Math.PI})`}
                  style={interactionStyle}
                  onPointerDown={onFurniturePointerDown}
                  onContextMenu={(e) => {
                    if (isDrawWallTool || placeTool === 'measure') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(item.id)
                  }}
                  onDoubleClick={(e) => {
                    if (placeTool !== 'select') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(item.id)
                    onEditSize(item.id)
                  }}
                >
                  <title>
                    {item.label} · {(w * 100).toFixed(0)}×{(d * 100).toFixed(0)} cm
                    {placeTool === 'move'
                      ? ' · drag to move'
                      : ' · drag to move · double-click size'}
                  </title>
                  {/* Hit target */}
                  <rect
                    x={-w / 2}
                    y={-d / 2}
                    width={w}
                    height={d}
                    fill={selected ? '#93c5fd55' : '#0000'}
                    stroke="none"
                  />
                  <PlanFurnitureSymbol
                    type={item.type}
                    w={w}
                    d={d}
                    fill={fill}
                    stroke={stroke}
                  />
                </g>
              ) : (
                <polygon
                  points={corners.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={selected ? 0.045 : 0.025}
                  style={interactionStyle}
                  onPointerDown={onFurniturePointerDown}
                  onContextMenu={(e) => {
                    if (isDrawWallTool || placeTool === 'measure') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(item.id)
                  }}
                  onDoubleClick={(e) => {
                    if (placeTool !== 'select') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(item.id)
                    onEditSize(item.id)
                  }}
                >
                  <title>
                    {item.label} · {(w * 100).toFixed(0)}×{(d * 100).toFixed(0)} cm
                    {placeTool === 'move'
                      ? ' · drag to move'
                      : ' · drag to move · double-click size'}
                  </title>
                </polygon>
              )}

              {selected && !ghost && (placeTool === 'select' || placeTool === 'move') && (
                <>
                  <text
                    x={tx(px)}
                    y={ty(pz) - 0.2}
                    textAnchor="middle"
                    fill="#1d4ed8"
                    fontSize={0.18}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    pointerEvents="none"
                  >
                    {`${(w * 100).toFixed(0)} × ${(d * 100).toFixed(0)} cm`}
                  </text>
                  {placeTool === 'select' && (
                    <g
                      style={{ cursor: 'pointer' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onRotateFurniture(item.id, Math.PI / 2)
                      }}
                    >
                      <circle
                        cx={tx(px)}
                        cy={ty(pz) + Math.max(w, d) * 0.55 + 0.15}
                        r={0.14}
                        fill="#1d4ed8"
                        stroke="#fff"
                        strokeWidth={0.025}
                      />
                      <text
                        x={tx(px)}
                        y={ty(pz) + Math.max(w, d) * 0.55 + 0.2}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={0.16}
                        fontFamily="Segoe UI, Helvetica, sans-serif"
                        pointerEvents="none"
                      >
                        ↻
                      </text>
                    </g>
                  )}
                  {placeTool === 'select' &&
                    !ghost &&
                    handles.map((h) => {
                    const p = handleWorld(h.lx, h.lz)
                    return (
                      <rect
                        key={h.id}
                        x={tx(p.x) - HANDLE / 2}
                        y={ty(p.z) - HANDLE / 2}
                        width={HANDLE}
                        height={HANDLE}
                        fill="#1d4ed8"
                        stroke="#fff"
                        strokeWidth={0.02}
                        style={{ cursor: h.cursor }}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          const world = svgToWorld(e.clientX, e.clientY)
                          if (!world) return
                          setDrag({
                            kind: 'resize',
                            id: item.id,
                            handle: h.id,
                            startW: w,
                            startD: d,
                            startX: px,
                            startZ: pz,
                            startMx: world.x,
                            startMz: world.z,
                            rotation: item.rotation,
                          })
                        }}
                      />
                    )
                  })}
                </>
              )}
            </g>
          )
        })}

        {/* Ceiling lights (reflected ceiling plan) */}
        {(ceilingPlanMode || ceilingLights.length > 0) &&
          ceilingLights.map((light) => {
            const [px, pz] = light.position
            const selected = selectedId === light.id
            const [lw, ld] = light.size
            const c = Math.cos(light.rotation)
            const s = Math.sin(light.rotation)
            const corners: [number, number][] =
              light.kind === 'strip'
                ? (
                    [
                      [-lw / 2, -ld / 2],
                      [lw / 2, -ld / 2],
                      [lw / 2, ld / 2],
                      [-lw / 2, ld / 2],
                    ] as [number, number][]
                  ).map(([lx, lz]) => [px + lx * c + lz * s, pz - lx * s + lz * c])
                : []
            const r = light.kind === 'industrial' ? Math.max(lw, ld) / 2 : 0
            const canInteract =
              ceilingPlanMode && (placeTool === 'select' || placeTool === 'move')
            return (
              <g key={light.id} opacity={ceilingPlanMode ? 1 : 0.35}>
                {light.kind === 'strip' ? (
                  <polygon
                    points={corners.map(([x, z]) => `${tx(x)},${ty(z)}`).join(' ')}
                    fill={selected ? '#fde68a' : '#fef3c7'}
                    stroke={selected ? '#d97706' : '#b45309'}
                    strokeWidth={selected ? 0.04 : 0.025}
                    style={{ cursor: canInteract ? 'grab' : 'default' }}
                    pointerEvents={canInteract ? 'auto' : 'none'}
                    onPointerDown={(e) => {
                      if (!canInteract) return
                      e.stopPropagation()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      onSelect(light.id)
                      const world = svgToWorld(e.clientX, e.clientY)
                      if (!world) return
                      setDrag({
                        kind: 'ceiling',
                        id: light.id,
                        ox: world.x - px,
                        oz: world.z - pz,
                      })
                    }}
                  />
                ) : (
                  <g
                    style={{ cursor: canInteract ? 'grab' : 'default' }}
                    pointerEvents={canInteract ? 'auto' : 'none'}
                    onPointerDown={(e) => {
                      if (!canInteract) return
                      e.stopPropagation()
                      e.currentTarget.setPointerCapture(e.pointerId)
                      onSelect(light.id)
                      const world = svgToWorld(e.clientX, e.clientY)
                      if (!world) return
                      setDrag({
                        kind: 'ceiling',
                        id: light.id,
                        ox: world.x - px,
                        oz: world.z - pz,
                      })
                    }}
                  >
                    <circle
                      cx={tx(px)}
                      cy={ty(pz)}
                      r={r}
                      fill={
                        selected
                          ? '#fde68a'
                          : light.kind === 'globe'
                            ? '#fef9c3'
                            : '#e7e5e4'
                      }
                      stroke={
                        selected
                          ? '#d97706'
                          : light.kind === 'globe'
                            ? '#ca8a04'
                            : '#57534e'
                      }
                      strokeWidth={selected ? 0.04 : 0.03}
                    />
                    <circle
                      cx={tx(px)}
                      cy={ty(pz)}
                      r={r * (light.kind === 'globe' ? 0.55 : 0.35)}
                      fill={light.kind === 'globe' ? 'rgba(254,249,195,0.5)' : 'none'}
                      stroke={
                        selected
                          ? '#d97706'
                          : light.kind === 'globe'
                            ? '#eab308'
                            : '#78716c'
                      }
                      strokeWidth={0.02}
                      pointerEvents="none"
                    />
                  </g>
                )}
                {ceilingPlanMode && (
                  <text
                    x={tx(px)}
                    y={ty(pz) + (light.kind === 'strip' ? ld * 0.5 + 0.18 : r + 0.18)}
                    textAnchor="middle"
                    fill="#92400e"
                    fontSize={0.14}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={600}
                    pointerEvents="none"
                  >
                    {light.kind === 'strip'
                      ? 'LED'
                      : light.kind === 'globe'
                        ? 'Globe'
                        : 'Pendant'}
                  </text>
                )}
              </g>
            )
          })}

        {/* Room names / info above furniture */}
        {useDefaultRooms &&
          (showRoomDimensions || showInnerArea || showOuterArea) &&
          ROOMS.map((room) => {
          const xs = room.polygon.map((p) => p[0])
          const zs = room.polygon.map((p) => p[1])
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minZ = Math.min(...zs)
          const maxZ = Math.max(...zs)
          const widthM = room.width || maxX - minX
          const depthM = room.length || maxZ - minZ
          // Offset from clear faces — far enough to clear outer wall thickness
          const off = 0.48
          const t = 0.15
          const outerArea = (widthM + t) * (depthM + t)

          return (
            <g key={`label-${room.id}`} pointerEvents="none">
              {showRoomDimensions && (
                <>
                  <text
                    x={tx(room.labelAt[0])}
                    y={ty(room.labelAt[1])}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#111"
                    fontSize={0.32}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={700}
                  >
                    {room.name}
                  </text>
                  <text
                    x={tx(room.labelAt[0])}
                    y={ty(room.labelAt[1]) + 0.36}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#333"
                    fontSize={0.24}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={600}
                  >
                    {`${(depthM * 100).toFixed(0)} × ${(widthM * 100).toFixed(0)} cm`}
                  </text>
                </>
              )}
              {showInnerArea && (
                <text
                  x={tx(room.labelAt[0])}
                  y={
                    ty(room.labelAt[1]) +
                    (showRoomDimensions ? 0.62 : 0)
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#166534"
                  fontSize={0.18}
                  fontFamily="Segoe UI, Helvetica, sans-serif"
                  fontWeight={600}
                >
                  {`Inner ${room.area.toFixed(2)} m²`}
                </text>
              )}
              {showOuterArea && (
                <text
                  x={tx(room.labelAt[0])}
                  y={
                    ty(room.labelAt[1]) +
                    (showRoomDimensions ? 0.62 : 0) +
                    (showInnerArea ? 0.22 : 0)
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#9a3412"
                  fontSize={0.18}
                  fontFamily="Segoe UI, Helvetica, sans-serif"
                  fontWeight={600}
                >
                  {`Outer ${outerArea.toFixed(2)} m²`}
                </text>
              )}

              {showRoomDimensions && (
              <g stroke={ROOM_DIM_STROKE} strokeWidth={0.03} fill={ROOM_DIM_STROKE}>
                  {/* width dimension (south edge) — ticks at clear faces */}
                  <line
                    x1={tx(minX)}
                    y1={ty(minZ) + off}
                    x2={tx(maxX)}
                    y2={ty(minZ) + off}
                  />
                  <line
                    x1={tx(minX)}
                    y1={ty(minZ) + off - 0.08}
                    x2={tx(minX)}
                    y2={ty(minZ) + off + 0.08}
                  />
                  <line
                    x1={tx(maxX)}
                    y1={ty(minZ) + off - 0.08}
                    x2={tx(maxX)}
                    y2={ty(minZ) + off + 0.08}
                  />
                  <text
                    x={tx((minX + maxX) / 2)}
                    y={ty(minZ) + off + 0.22}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={ROOM_DIM_FILL}
                    stroke="none"
                    fontSize={0.2}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={700}
                  >
                    {`${(widthM * 100).toFixed(0)} cm`}
                  </text>

                  {/* depth dimension (west edge) */}
                  <line
                    x1={tx(minX) - off}
                    y1={ty(minZ)}
                    x2={tx(minX) - off}
                    y2={ty(maxZ)}
                  />
                  <line
                    x1={tx(minX) - off - 0.08}
                    y1={ty(minZ)}
                    x2={tx(minX) - off + 0.08}
                    y2={ty(minZ)}
                  />
                  <line
                    x1={tx(minX) - off - 0.08}
                    y1={ty(maxZ)}
                    x2={tx(minX) - off + 0.08}
                    y2={ty(maxZ)}
                  />
                  <text
                    x={tx(minX) - off - 0.2}
                    y={ty((minZ + maxZ) / 2)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={ROOM_DIM_FILL}
                    stroke="none"
                    fontSize={0.2}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={700}
                    transform={`rotate(-90 ${tx(minX) - off - 0.2} ${ty((minZ + maxZ) / 2)})`}
                  >
                    {`${(depthM * 100).toFixed(0)} cm`}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {!useDefaultRooms &&
          customRooms.map((room) => {
            const { span, inner } = room
            const kind = normalizeRoomKind(roomKinds[room.id])
            const name = roomNames[room.id] || ROOM_KIND_LABEL[kind]
            // Dimension ticks span clear faces; line sits outside the wall body
            const eMinX = inner.minX
            const eMinZ = inner.minZ
            const eW = inner.w
            const eD = inner.d
            const off = Math.max(0.42, (room.avgThickness || 0.2) + 0.28)
            const labelX = span.minX + span.w / 2
            const labelZ = span.minZ + span.d / 2
            return (
              <g key={`label-${room.id}`}>
                <g pointerEvents="none">
                  {showRoomDimensions && (
                  <g stroke={ROOM_DIM_STROKE} strokeWidth={0.03} fill={ROOM_DIM_STROKE}>
                    <line
                      x1={tx(eMinX)}
                      y1={ty(eMinZ) + off}
                      x2={tx(eMinX + eW)}
                      y2={ty(eMinZ) + off}
                    />
                    <line
                      x1={tx(eMinX)}
                      y1={ty(eMinZ) + off - 0.08}
                      x2={tx(eMinX)}
                      y2={ty(eMinZ) + off + 0.08}
                    />
                    <line
                      x1={tx(eMinX + eW)}
                      y1={ty(eMinZ) + off - 0.08}
                      x2={tx(eMinX + eW)}
                      y2={ty(eMinZ) + off + 0.08}
                    />
                    <text
                      x={tx(eMinX + eW / 2)}
                      y={ty(eMinZ) + off + 0.22}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={ROOM_DIM_FILL}
                      stroke="none"
                      fontSize={0.2}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                    >
                      {`${(eW * 100).toFixed(0)} cm`}
                    </text>
                    <line
                      x1={tx(eMinX) - off}
                      y1={ty(eMinZ)}
                      x2={tx(eMinX) - off}
                      y2={ty(eMinZ + eD)}
                    />
                    <line
                      x1={tx(eMinX) - off - 0.08}
                      y1={ty(eMinZ)}
                      x2={tx(eMinX) - off + 0.08}
                      y2={ty(eMinZ)}
                    />
                    <line
                      x1={tx(eMinX) - off - 0.08}
                      y1={ty(eMinZ + eD)}
                      x2={tx(eMinX) - off + 0.08}
                      y2={ty(eMinZ + eD)}
                    />
                    <text
                      x={tx(eMinX) - off - 0.2}
                      y={ty(eMinZ + eD / 2)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={ROOM_DIM_FILL}
                      stroke="none"
                      fontSize={0.2}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={700}
                      transform={`rotate(-90 ${tx(eMinX) - off - 0.2} ${ty(eMinZ + eD / 2)})`}
                    >
                      {`${(eD * 100).toFixed(0)} cm`}
                    </text>
                  </g>
                  )}
                </g>
                <text
                  x={tx(labelX)}
                  y={ty(labelZ) - (showRoomDimensions ? 0.28 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#111"
                  fontSize={0.28}
                  fontFamily="Segoe UI, Helvetica, sans-serif"
                  fontWeight={700}
                  style={{
                    cursor:
                      placeTool === 'select' || placeTool === 'move'
                        ? 'pointer'
                        : 'inherit',
                    pointerEvents:
                      placeTool === 'select' || placeTool === 'move' ? 'auto' : 'none',
                  }}
                  onPointerDown={(e) => {
                    if (placeTool !== 'select' && placeTool !== 'move') return
                    e.stopPropagation()
                    onSelect(room.id)
                    setPlaceTool('select')
                  }}
                  onDoubleClick={(e) => {
                    if (placeTool !== 'select' && placeTool !== 'move') return
                    e.preventDefault()
                    e.stopPropagation()
                    onSelect(room.id)
                    onEditRoom(room.id)
                  }}
                >
                  <title>{`${name} — double-click to set type (Room / Bath / Terrace)`}</title>
                  {name}
                </text>
                <g pointerEvents="none">
                  {showRoomDimensions && (
                  <>
                  <text
                    x={tx(labelX)}
                    y={ty(labelZ)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={ROOM_DIM_FILL}
                    fontSize={0.2}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                    fontWeight={600}
                  >
                    {`${(eD * 100).toFixed(0)} × ${(eW * 100).toFixed(0)} cm`}
                  </text>
                  <text
                    x={tx(labelX)}
                    y={ty(labelZ) + 0.22}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#64748b"
                    fontSize={0.14}
                    fontFamily="Segoe UI, Helvetica, sans-serif"
                  >
                    clear (face to face)
                  </text>
                  </>
                  )}
                  {showInnerArea && (
                    <text
                      x={tx(labelX)}
                      y={ty(labelZ) + (showRoomDimensions ? 0.44 : 0.22)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#166534"
                      fontSize={0.17}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={600}
                    >
                      {`Inner ${inner.area.toFixed(2)} m² · ${(inner.d * 100).toFixed(0)} × ${(inner.w * 100).toFixed(0)}`}
                    </text>
                  )}
                  {showOuterArea && (
                    <text
                      x={tx(labelX)}
                      y={
                        ty(labelZ) +
                        (showRoomDimensions ? 0.44 : 0.22) +
                        (showInnerArea ? 0.22 : 0)
                      }
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#9a3412"
                      fontSize={0.17}
                      fontFamily="Segoe UI, Helvetica, sans-serif"
                      fontWeight={600}
                    >
                      {`Outer ${outer.area.toFixed(2)} m²`}
                    </text>
                  )}
                </g>
              </g>
            )
          })}

        {showCompass && (
        <g
          transform={`translate(${compassCx}, ${compassCy})`}
          style={{
            cursor:
              drag?.kind === 'north-move' || drag?.kind === 'north-rotate'
                ? 'grabbing'
                : 'grab',
          }}
        >
          <title>Drag disc to move · drag N arrow to set true north</title>
          <circle
            r={COMPASS_R}
            fill="#fff"
            stroke="#111"
            strokeWidth={0.035}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              const local = svgLocal(e.clientX, e.clientY)
              if (!local) return
              const u = compassCx / vbW
              const v = compassCy / vbH
              setDrag({
                kind: 'north-move',
                ox: local.x - compassCx,
                oy: local.y - compassCy,
                startU: u,
                startV: v,
              })
            }}
          />
          <circle
            r={COMPASS_R * 0.82}
            fill="none"
            stroke="#ddd"
            strokeWidth={0.02}
            pointerEvents="none"
          />
          <g
            transform={`rotate(${(northAngle * 180) / Math.PI})`}
            style={{ cursor: drag?.kind === 'north-rotate' ? 'grabbing' : 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              setDrag({ kind: 'north-rotate' })
              const ang = angleFromPointer(e.clientX, e.clientY)
              if (ang != null) onNorthAngleChange(ang)
            }}
          >
            <line
              x1={0}
              y1={COMPASS_R * 0.2}
              x2={0}
              y2={-COMPASS_R * 0.55}
              stroke="#111"
              strokeWidth={0.045}
            />
            <polygon
              points={`0,${-COMPASS_R * 0.72} ${-COMPASS_R * 0.18},${-COMPASS_R * 0.28} ${COMPASS_R * 0.18},${-COMPASS_R * 0.28}`}
              fill="#111"
            />
            {/* Hit target around the N arrow only — disc body stays free to move */}
            <circle
              cx={0}
              cy={-COMPASS_R * 0.42}
              r={COMPASS_R * 0.34}
              fill="transparent"
              stroke="none"
            />
            <text
              x={0}
              y={-COMPASS_R * 0.88}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#111"
              fontSize={0.2}
              fontFamily="Segoe UI, Helvetica, sans-serif"
              fontWeight={700}
              pointerEvents="none"
            >
              N
            </text>
          </g>
          <text
            x={0}
            y={COMPASS_R + 0.28}
            textAnchor="middle"
            fill="#444"
            fontSize={0.16}
            fontFamily="Segoe UI, Helvetica, sans-serif"
            pointerEvents="none"
          >
            {`${Math.round(northDeg)}°`}
          </text>
        </g>
        )}
      </svg>

      {wallLengthEdit && (
        <div
          className="modal-backdrop plan2d-length-backdrop"
          onClick={() => setWallLengthEdit(null)}
          role="presentation"
        >
          <div
            className="modal-card plan2d-length-card"
            role="dialog"
            aria-modal="true"
            aria-label="Wall length"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <h2>Wall length</h2>
              <p className="hint">Outer length tip-to-tip including corners (cm)</p>
            </header>
            <div className="modal-body">
              <label className="field">
                <span>Length (cm)</span>
                <input
                  ref={lengthInputRef}
                  type="number"
                  min={Math.round(MIN_WALL_LEN * 100)}
                  step={1}
                  value={wallLengthEdit.lengthCm}
                  onChange={(e) =>
                    setWallLengthEdit((prev) =>
                      prev ? { ...prev, lengthCm: e.target.value } : prev,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyWallLengthEdit()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setWallLengthEdit(null)
                    }
                  }}
                />
              </label>
            </div>
            <footer className="modal-footer">
              <button type="button" className="btn" onClick={() => setWallLengthEdit(null)}>
                Cancel
              </button>
              <button type="button" className="btn primary" onClick={applyWallLengthEdit}>
                Apply
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

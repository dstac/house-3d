import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Scene, { type SceneSettings } from './components/Scene'
import Controls from './components/Controls'
import FloorPlan2D from './components/FloorPlan2D'
import SizeEditModal from './components/SizeEditModal'
import OpeningEditModal from './components/OpeningEditModal'
import {
  DEFAULT_OPENING_LAYOUT,
  DEFAULT_OPENING_STATE,
  DEFAULT_PARTITION_LAYOUT,
  DEFAULT_PARTITION_STATE,
  DEFAULT_WALLS,
  softAddDefaultGlassPartitions,
  DEFAULT_WALL_THICKNESS,
  INITIAL_FURNITURE,
  deriveBuilding,
  listPlanOpenings,
  resolveOpeningDef,
  resolveOpeningVertical,
  usesDefaultRooms,
  wallIdForOpening,
  type CeilingLightDef,
  type FurnitureDef,
  type OpeningLayout,
  type OpeningLayoutEntry,
  type PartitionLayout,
  type RoomKind,
  type WallSeg,
  findCustomRectangularRooms,
  normalizeRoomKind,
  reconcileRoomMeta,
  ROOM_KIND_LABEL,
  wallEffectiveSide,
} from './data/floorPlan'
import RoomEditModal from './components/RoomEditModal'
import {
  assetFromFurniture,
  instantiateAsset,
  type LibraryAsset,
} from './data/furnitureLibrary'
import {
  deleteUserAsset,
  listUserAssets,
  saveUserAsset,
} from './lib/assetLibraryDb'
import {
  deletePlan,
  exportPlansToJson,
  getPlan,
  importPlansFromJson,
  listPlans,
  savePlan,
  type PlanPayload,
  type SavedPlanMeta,
} from './lib/planDb'
import { snapFurniturePosition } from './lib/snapToWalls'
import { exportPlanPdf } from './lib/exportPlanPdf'
import { captureSceneViews } from './lib/sceneCapture'
import './App.css'

const DEFAULT_SETTINGS: SceneSettings = {
  wallHeight: 2.5,
  wallColor: '#f4f1ec',
  floorColor: '#d4c4a8',
  tileColor: '#6a737c',
  furnitureColor: '#3a3e44',
  accentColor: '#a89078',
  showRoomDimensions: true,
  showInnerArea: true,
  showOuterArea: false,
  showWallLengths: true,
  showFloorPlan2D: false,
  showFurniture2D: true,
  showCompass: true,
  showRoomNames: true,
  showDoorLeaves: true,
  northAngle: 0,
  showRoof: false,
  showCeiling: true,
  showEnvironment: true,
  walkMode: false,
}

const STARTUP_PLAN_KEY = 'house-3d-startup-plan-id'

function normalizeAngle(rad: number) {
  const twoPi = Math.PI * 2
  let a = rad % twoPi
  if (a < 0) a += twoPi
  return a
}

/** Keep saved placements. Do not resurrect pieces the user deleted. */
function mergeFurniture(saved: FurnitureDef[]): FurnitureDef[] {
  if (!saved.length) return structuredClone(INITIAL_FURNITURE)
  const initById = new Map(INITIAL_FURNITURE.map((f) => [f.id, f]))
  const merged = saved.map((item) => {
    const init = initById.get(item.id)
    if (!init) return structuredClone(item)
    return {
      id: item.id,
      type: item.type || init.type,
      label: item.label || init.label,
      position: item.position,
      rotation: item.rotation,
      size: item.size,
      ...(item.color ? { color: item.color } : {}),
      ...(item.accentColor ? { accentColor: item.accentColor } : {}),
      ...(item.planIcon ? { planIcon: item.planIcon } : {}),
    }
  })
  // Soft-add newly introduced defaults if absent
  const softAddIds = ['bath-mirror']
  for (const id of softAddIds) {
    if (merged.some((i) => i.id === id)) continue
    const piece = INITIAL_FURNITURE.find((f) => f.id === id)
    if (piece) merged.push(structuredClone(piece))
  }
  return merged
}

function applyPayload(payload: PlanPayload) {
  const legacy = payload.walls === undefined
  const walls = softAddDefaultGlassPartitions(
    legacy
      ? structuredClone(DEFAULT_WALLS)
      : structuredClone(payload.walls ?? []),
  )
  // Bake an explicit body side onto older walls. Without it the side is inferred from
  // the centroid of ALL walls, so adding a terrace later would shift that centroid and
  // silently flip existing walls — changing rooms that were already measured.
  if (!legacy) {
    const sides = walls.map((w) =>
      w.glass || w.centerline || w.side === 1 || w.side === -1
        ? null
        : wallEffectiveSide(w, walls),
    )
    walls.forEach((w, i) => {
      const s = sides[i]
      if (s) w.side = s
    })
  }

  const furniture =
    payload.furniture === undefined
      ? structuredClone(INITIAL_FURNITURE)
      : payload.furniture.length === 0
        ? []
        : mergeFurniture(payload.furniture)

  const raw = { ...DEFAULT_SETTINGS, ...payload.settings }
  // Migrate older single showDimensions flag into granular toggles
  if (
    payload.settings &&
    payload.settings.showDimensions != null &&
    payload.settings.showRoomDimensions == null &&
    payload.settings.showInnerArea == null &&
    payload.settings.showOuterArea == null &&
    payload.settings.showWallLengths == null
  ) {
    const on = payload.settings.showDimensions !== false
    raw.showRoomDimensions = on
    raw.showInnerArea = on
    raw.showOuterArea = false
    raw.showWallLengths = on
  }

  const partitionLayout = legacy
    ? {
        ...DEFAULT_PARTITION_LAYOUT,
        ...(payload.partitionLayout ?? {}),
      }
    : { ...(payload.partitionLayout ?? {}) }
  const partitionsEnabled = legacy
    ? {
        ...DEFAULT_PARTITION_STATE,
        ...(payload.partitionsEnabled ?? {}),
      }
    : { ...(payload.partitionsEnabled ?? {}) }
  // Soft-added glass screens need layout + enabled defaults
  for (const w of walls) {
    if (!w.glass) continue
    if (!partitionLayout[w.id]) {
      partitionLayout[w.id] = {
        a: [...w.a] as [number, number],
        b: [...w.b] as [number, number],
      }
    }
    if (partitionsEnabled[w.id] === undefined) partitionsEnabled[w.id] = true
  }

  return {
    settings: raw,
    furniture,
    walls,
    openingsEnabled: legacy
      ? { ...DEFAULT_OPENING_STATE, ...payload.openingsEnabled }
      : { ...(payload.openingsEnabled ?? {}) },
    openingLayout: legacy
      ? { ...DEFAULT_OPENING_LAYOUT, ...payload.openingLayout }
      : { ...(payload.openingLayout ?? {}) },
    partitionLayout,
    partitionsEnabled,
    roomNames: { ...(payload.roomNames ?? {}) },
    roomKinds: Object.fromEntries(
      Object.entries(payload.roomKinds ?? {}).map(([id, k]) => [id, normalizeRoomKind(k)]),
    ) as Record<string, RoomKind>,
    ceilingLights: structuredClone(payload.ceilingLights ?? []),
  }
}

function rememberStartupPlan(id: number) {
  try {
    localStorage.setItem(STARTUP_PLAN_KEY, String(id))
  } catch {
    /* ignore */
  }
}

function readStartupPlanId(): number | null {
  try {
    const raw = localStorage.getItem(STARTUP_PLAN_KEY)
    if (!raw) return null
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

export default function App() {
  const [settings, setSettings] = useState<SceneSettings>(DEFAULT_SETTINGS)
  const [furniture, setFurniture] = useState<FurnitureDef[]>(() =>
    structuredClone(INITIAL_FURNITURE),
  )
  const [walls, setWalls] = useState<WallSeg[]>(() => structuredClone(DEFAULT_WALLS))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [openingsEnabled, setOpeningsEnabled] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_OPENING_STATE }),
  )
  const [openingLayout, setOpeningLayout] = useState<OpeningLayout>(() => ({
    ...DEFAULT_OPENING_LAYOUT,
  }))
  const [partitionLayout, setPartitionLayout] = useState<PartitionLayout>(() =>
    structuredClone(DEFAULT_PARTITION_LAYOUT),
  )
  const [partitionsEnabled, setPartitionsEnabled] = useState<Record<string, boolean>>(
    () => ({ ...DEFAULT_PARTITION_STATE }),
  )
  const [plans, setPlans] = useState<SavedPlanMeta[]>([])
  const [plansReady, setPlansReady] = useState(false)
  const [plansError, setPlansError] = useState<string | null>(null)
  const [walkLocked, setWalkLocked] = useState(false)
  const [sizeEditId, setSizeEditId] = useState<string | null>(null)
  const [openingEditId, setOpeningEditId] = useState<string | null>(null)
  const [activePlanId, setActivePlanId] = useState<number | null>(null)
  const [userLibrary, setUserLibrary] = useState<LibraryAsset[]>(() => listUserAssets())
  const [drawWallThickness, setDrawWallThickness] = useState(DEFAULT_WALL_THICKNESS)
  const [roomNames, setRoomNames] = useState<Record<string, string>>({})
  const [roomKinds, setRoomKinds] = useState<Record<string, RoomKind>>({})
  const [ceilingLights, setCeilingLights] = useState<CeilingLightDef[]>([])
  const [roomEditId, setRoomEditId] = useState<string | null>(null)

  const building = useMemo(() => deriveBuilding(walls), [walls])
  const defaultRooms = useMemo(() => usesDefaultRooms(walls), [walls])

  // Safety net: any custom wall still without an explicit body side (older saves,
  // state kept alive across a hot reload, imports) gets one baked in now, computed
  // once from the current wall set. Afterwards nothing infers sides from the global
  // centroid, so later additions (terraces, extensions) cannot flip existing walls.
  useEffect(() => {
    if (defaultRooms) return
    const needs = walls.some(
      (w) => !w.glass && !w.centerline && w.side !== 1 && w.side !== -1,
    )
    if (!needs) return
    setWalls((prev) =>
      prev.map((w) =>
        w.glass || w.centerline || w.side === 1 || w.side === -1
          ? w
          : { ...w, side: wallEffectiveSide(w, prev) },
      ),
    )
  }, [walls, defaultRooms])
  const customRooms = useMemo(
    () => (defaultRooms ? [] : findCustomRectangularRooms(walls)),
    [defaultRooms, walls],
  )
  const prevCustomRoomsRef = useRef(customRooms)
  const roomNamesRef = useRef(roomNames)
  const roomKindsRef = useRef(roomKinds)
  roomNamesRef.current = roomNames
  roomKindsRef.current = roomKinds

  // Preserve names/kinds when room detection ids change (new walls shift axes)
  useEffect(() => {
    if (defaultRooms) {
      prevCustomRoomsRef.current = []
      return
    }
    const prevRooms = prevCustomRoomsRef.current
    prevCustomRoomsRef.current = customRooms
    const next = reconcileRoomMeta(
      customRooms,
      roomNamesRef.current,
      roomKindsRef.current,
      prevRooms,
    )
    const namesSame =
      Object.keys(next.names).length === Object.keys(roomNamesRef.current).length &&
      Object.entries(next.names).every(([id, n]) => roomNamesRef.current[id] === n)
    const kindsSame =
      Object.keys(next.kinds).length === Object.keys(roomKindsRef.current).length &&
      Object.entries(next.kinds).every(([id, k]) => roomKindsRef.current[id] === k)
    if (!namesSame) setRoomNames(next.names)
    if (!kindsSame) setRoomKinds(next.kinds)
  }, [customRooms, defaultRooms])

  useEffect(() => {
    if (!settings.walkMode) setWalkLocked(false)
  }, [settings.walkMode])

  const refreshPlans = useCallback(async () => {
    const next = await listPlans()
    setPlans(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const boot = () => {
      void (async () => {
        try {
          const listed = await listPlans()
          if (cancelled) return
          setPlans(listed)
          setPlansReady(true)
          setPlansError(null)

          const preferredId = readStartupPlanId()
          const startup =
            listed.find((p) => p.id === preferredId) ?? listed[0] ?? null
          if (!startup) return

          const plan = await getPlan(startup.id)
          if (!plan || cancelled) return
          const applied = applyPayload(plan.payload)
          setSettings(applied.settings)
          setFurniture(applied.furniture)
          setWalls(applied.walls)
          setOpeningsEnabled(applied.openingsEnabled)
          setOpeningLayout(applied.openingLayout)
          setPartitionLayout(applied.partitionLayout)
          setPartitionsEnabled(applied.partitionsEnabled)
          setRoomNames(applied.roomNames)
          setRoomKinds(applied.roomKinds)
          setCeilingLights(applied.ceilingLights)
          setActivePlanId(startup.id)
          rememberStartupPlan(startup.id)
        } catch (err) {
          if (!cancelled) {
            setPlansError(err instanceof Error ? err.message : 'Could not open SQLite')
            setPlansReady(false)
          }
        }
      })()
    }
    const id = window.setTimeout(boot, 0)
    return () => {
      cancelled = true
      window.clearTimeout(id)
    }
  }, [refreshPlans])

  const selected = useMemo(
    () => furniture.find((f) => f.id === selectedId) ?? null,
    [furniture, selectedId],
  )
  const selectedCeiling = useMemo(
    () => ceilingLights.find((l) => l.id === selectedId) ?? null,
    [ceilingLights, selectedId],
  )

  const selectedLabel = selected?.label ?? selectedCeiling?.label ?? null
  const selectedRotationDeg = selected
    ? Math.round((normalizeAngle(selected.rotation) * 180) / Math.PI)
    : selectedCeiling
      ? Math.round((normalizeAngle(selectedCeiling.rotation) * 180) / Math.PI)
      : null

  const onMove = useCallback((id: string, position: [number, number, number]) => {
    setDragging(true)
    setFurniture((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const others = prev.filter((f) => f.id !== id)
        const [sx, sz] = snapFurniturePosition(
          position[0],
          position[2],
          item.size,
          item.rotation,
          walls,
          others,
        )
        return { ...item, position: [sx, position[1], sz] }
      }),
    )
  }, [walls])

  const onMoveQuiet = useCallback((id: string, position: [number, number, number]) => {
    setFurniture((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        const others = prev.filter((f) => f.id !== id)
        const [sx, sz] = snapFurniturePosition(
          position[0],
          position[2],
          item.size,
          item.rotation,
          walls,
          others,
        )
        return { ...item, position: [sx, position[1], sz] }
      }),
    )
  }, [walls])

  const onResizeFurniture = useCallback(
    (
      id: string,
      size: [number, number, number],
      position: [number, number, number],
    ) => {
      setFurniture((prev) =>
        prev.map((item) => (item.id === id ? { ...item, size, position } : item)),
      )
    },
    [],
  )

  const onUpdateOpening = useCallback((id: string, next: OpeningLayoutEntry) => {
    setOpeningLayout((prev) => ({ ...prev, [id]: { ...prev[id], ...next } }))
  }, [])

  const onAddOpening = useCallback((id: string, entry: OpeningLayoutEntry) => {
    setOpeningLayout((prev) => ({ ...prev, [id]: entry }))
    setOpeningsEnabled((prev) => ({ ...prev, [id]: true }))
  }, [])

  const onRemoveOpening = useCallback((id: string) => {
    setOpeningLayout((prev) => {
      const cur = prev[id]
      const isCustom = Boolean(cur?.wallId && cur?.kind)
      if (isCustom) {
        const next = { ...prev }
        delete next[id]
        return next
      }
      return {
        ...prev,
        [id]: {
          ...(cur ?? DEFAULT_OPENING_LAYOUT[id] ?? { t0: 0.4, t1: 0.6 }),
          removed: true,
        },
      }
    })
    setOpeningsEnabled((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setOpeningEditId((cur) => (cur === id ? null : cur))
  }, [])

  const onAddWall = useCallback((wall: WallSeg) => {
    setWalls((prev) => [...prev, wall])
    setSelectedId(wall.id)
  }, [])

  const onUpdateWall = useCallback((id: string, next: Partial<WallSeg>) => {
    setWalls((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w
        const merged = { ...w, ...next }
        if (next.a || next.b) {
          const len = Math.hypot(merged.b[0] - merged.a[0], merged.b[1] - merged.a[1])
          merged.label = merged.glass
            ? `Glass ${(len * 100).toFixed(0)} cm`
            : `Wall ${(len * 100).toFixed(0)} cm`
        }
        return merged
      }),
    )
  }, [])

  const onRemoveWall = useCallback((id: string) => {
    setWalls((prev) => prev.filter((w) => w.id !== id))
    setOpeningLayout((prev) => {
      const next = { ...prev }
      for (const [oid, entry] of Object.entries(next)) {
        if (entry.wallId === id) delete next[oid]
      }
      return next
    })
    setOpeningsEnabled((prev) => {
      const next = { ...prev }
      for (const [oid, entry] of Object.entries(openingLayout)) {
        if (entry.wallId === id) delete next[oid]
      }
      return next
    })
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [openingLayout])

  const onMovePartition = useCallback(
    (id: string, a: [number, number], b: [number, number]) => {
      setPartitionLayout((prev) => ({ ...prev, [id]: { a, b } }))
    },
    [],
  )

  const onTogglePartition = useCallback((id: string, enabled: boolean) => {
    setPartitionsEnabled((prev) => ({ ...prev, [id]: enabled }))
  }, [])

  const onRotate = useCallback((id: string, delta: number) => {
    setFurniture((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, rotation: normalizeAngle(item.rotation + delta) }
          : item,
      ),
    )
  }, [])

  const onRotateSelected = useCallback(
    (delta: number) => {
      if (!selectedId) return
      onRotate(selectedId, delta)
    },
    [selectedId, onRotate],
  )

  const onDeleteSelected = useCallback(() => {
    if (!selectedId) return
    if (walls.some((w) => w.id === selectedId && !w.glass)) {
      onRemoveWall(selectedId)
      return
    }
    const opening = resolveOpeningDef(selectedId, openingLayout, walls)
    if (opening) {
      onRemoveOpening(selectedId)
      setSelectedId(null)
      return
    }
    if (ceilingLights.some((l) => l.id === selectedId)) {
      setCeilingLights((prev) => prev.filter((l) => l.id !== selectedId))
      setSelectedId(null)
      return
    }
    setFurniture((prev) => prev.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }, [selectedId, openingLayout, walls, ceilingLights, onRemoveOpening, onRemoveWall])

  const onAddCeilingLight = useCallback((light: CeilingLightDef) => {
    setCeilingLights((prev) => [...prev, light])
    setSelectedId(light.id)
  }, [])

  const onUpdateCeilingLight = useCallback((id: string, next: Partial<CeilingLightDef>) => {
    setCeilingLights((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...next } : l)),
    )
  }, [])

  const onRemoveCeilingLight = useCallback((id: string) => {
    setCeilingLights((prev) => prev.filter((l) => l.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
  }, [])

  const onSaveSelectedToLibrary = useCallback(
    (name: string) => {
      const item = furniture.find((f) => f.id === selectedId)
      if (!item) return
      const asset = assetFromFurniture(item, name)
      setUserLibrary(saveUserAsset(asset))
    },
    [furniture, selectedId],
  )

  const onPlaceLibraryAsset = useCallback((asset: LibraryAsset) => {
    setFurniture((prev) => {
      const ids = new Set(prev.map((f) => f.id))
      const next = instantiateAsset(asset, ids)
      setSelectedId(next.id)
      return [...prev, next]
    })
  }, [])

  const onDeleteLibraryAsset = useCallback((id: string) => {
    setUserLibrary(deleteUserAsset(id))
  }, [])

  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id)
    if (!id) setDragging(false)
  }, [])

  const handlePointerUp = useCallback(() => {
    setDragging(false)
  }, [])

  const onToggleOpening = useCallback((id: string, enabled: boolean) => {
    setOpeningsEnabled((prev) => ({ ...prev, [id]: enabled }))
  }, [])

  const onSavePlan = useCallback(
    async (name: string) => {
      const payload: PlanPayload = {
        settings: structuredClone(settings),
        furniture: structuredClone(furniture),
        openingsEnabled: { ...openingsEnabled },
        openingLayout: { ...openingLayout },
        partitionLayout: structuredClone(partitionLayout),
        partitionsEnabled: { ...partitionsEnabled },
        walls: structuredClone(walls),
        roomNames: { ...roomNames },
        roomKinds: { ...roomKinds },
        ceilingLights: structuredClone(ceilingLights),
      }
      const id = await savePlan(name, payload)
      await refreshPlans()
      setActivePlanId(id)
      rememberStartupPlan(id)
    },
    [
      settings,
      furniture,
      openingsEnabled,
      openingLayout,
      partitionLayout,
      partitionsEnabled,
      walls,
      roomNames,
      roomKinds,
      ceilingLights,
      refreshPlans,
    ],
  )

  const onOverwritePlan = useCallback(
    async (id: number) => {
      const plan = plans.find((p) => p.id === id)
      if (!plan) return
      await onSavePlan(plan.name)
    },
    [plans, onSavePlan],
  )

  const onEditSize = useCallback((id: string) => {
    setSelectedId(id)
    setOpeningEditId(null)
    setSizeEditId(id)
  }, [])

  const onEditOpening = useCallback((id: string) => {
    setSelectedId(id)
    setSizeEditId(null)
    setOpeningEditId(id)
  }, [])

  const sizeEditItem = useMemo(
    () => furniture.find((f) => f.id === sizeEditId) ?? null,
    [furniture, sizeEditId],
  )

  const openingEdit = useMemo(() => {
    if (!openingEditId) return null
    const opening = resolveOpeningDef(openingEditId, openingLayout, walls)
    if (!opening) return null
    const wallId = wallIdForOpening(openingEditId, openingLayout, walls)
    const wall = walls.find((w) => w.id === wallId)
    if (!wall) return null
    const wallLen = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) || 1
    const width = (opening.t1 - opening.t0) * wallLen
    const vertical = resolveOpeningVertical(opening, settings.wallHeight)
    return { opening, wallLen, width, ...vertical }
  }, [openingEditId, openingLayout, settings.wallHeight, walls])

  const onLoadPlan = useCallback(async (id: number) => {
    const plan = await getPlan(id)
    if (!plan) return
    const applied = applyPayload(plan.payload)
    setSettings(applied.settings)
    setFurniture(applied.furniture)
    setWalls(applied.walls)
    setOpeningsEnabled(applied.openingsEnabled)
    setOpeningLayout(applied.openingLayout)
    setPartitionLayout(applied.partitionLayout)
    setPartitionsEnabled(applied.partitionsEnabled)
    setRoomNames(applied.roomNames)
    setRoomKinds(applied.roomKinds)
    setCeilingLights(applied.ceilingLights)
    setSelectedId(null)
    setSizeEditId(null)
    setOpeningEditId(null)
    setRoomEditId(null)
    setActivePlanId(id)
    rememberStartupPlan(id)
  }, [])

  const onNewPlan = useCallback(() => {
    if (
      !window.confirm(
        'Start a blank plan? Unsaved changes in the current plan will be lost.',
      )
    ) {
      return
    }
    setSettings((s) => ({ ...s, showFloorPlan2D: true, walkMode: false }))
    setFurniture([])
    setWalls([])
    setOpeningsEnabled({})
    setOpeningLayout({})
    setPartitionLayout({})
    setPartitionsEnabled({})
    setRoomNames({})
    setRoomKinds({})
    setCeilingLights([])
    setSelectedId(null)
    setSizeEditId(null)
    setOpeningEditId(null)
    setActivePlanId(null)
    try {
      localStorage.removeItem(STARTUP_PLAN_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  const onDeletePlan = useCallback(
    async (id: number) => {
      await deletePlan(id)
      await refreshPlans()
      setActivePlanId((cur) => (cur === id ? null : cur))
      if (readStartupPlanId() === id) {
        try {
          localStorage.removeItem(STARTUP_PLAN_KEY)
        } catch {
          /* ignore */
        }
      }
    },
    [refreshPlans],
  )

  const onExportPlans = useCallback(async () => {
    const doc = await exportPlansToJson()
    if (!doc.plans.length) throw new Error('No plans to export')
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `house-3d-plans-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const onExportPdf = useCallback(async () => {
    if (!walls.length) throw new Error('No walls to export')
    // Prefer the live 2D SVG when the plan overlay is open
    if (!settings.showFloorPlan2D) {
      setSettings((s) => ({ ...s, showFloorPlan2D: true }))
      await new Promise((r) => setTimeout(r, 120))
    }
    // Exit walk mode so orbit camera is available for multi-angle captures
    if (settings.walkMode) {
      setSettings((s) => ({ ...s, walkMode: false }))
      await new Promise((r) => setTimeout(r, 200))
    }
    const svg = document.querySelector('.plan2d-svg') as SVGSVGElement | null
    const active = plans.find((p) => p.id === activePlanId)
    let views3d: { label: string; dataUrl: string }[] = []
    try {
      views3d = await captureSceneViews()
    } catch {
      views3d = []
    }
    await exportPlanPdf({
      planName: active?.name ?? 'Floor plan',
      walls,
      building,
      useDefaultRooms: defaultRooms,
      roomNames,
      roomKinds,
      openingLayout,
      openingsEnabled,
      partitionLayout,
      partitionsEnabled,
      furniture,
      svgElement: svg,
      views3d,
    })
  }, [
    settings.showFloorPlan2D,
    settings.walkMode,
    plans,
    activePlanId,
    walls,
    building,
    defaultRooms,
    roomNames,
    roomKinds,
    openingLayout,
    openingsEnabled,
    partitionLayout,
    partitionsEnabled,
    furniture,
  ])

  const onImportPlans = useCallback(
    async (file: File) => {
      const text = await file.text()
      const doc = JSON.parse(text) as unknown
      const count = await importPlansFromJson(doc)
      if (!count) throw new Error('No plans found in file')
      await refreshPlans()
    },
    [refreshPlans],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'r' || e.key === 'R') {
        if (resolveOpeningDef(selectedId, openingLayout, walls)) return
        if (walls.some((w) => w.id === selectedId)) return
        e.preventDefault()
        const ceil = ceilingLights.find((l) => l.id === selectedId)
        if (ceil) {
          onUpdateCeilingLight(selectedId, { rotation: ceil.rotation + Math.PI / 2 })
          return
        }
        onRotate(selectedId, Math.PI / 2)
      } else if (e.key === 'q' || e.key === 'Q') {
        if (resolveOpeningDef(selectedId, openingLayout, walls)) return
        if (walls.some((w) => w.id === selectedId)) return
        e.preventDefault()
        const ceil = ceilingLights.find((l) => l.id === selectedId)
        if (ceil) {
          onUpdateCeilingLight(selectedId, { rotation: ceil.rotation - Math.PI / 2 })
          return
        }
        onRotate(selectedId, -Math.PI / 2)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    selectedId,
    onRotate,
    onDeleteSelected,
    openingLayout,
    walls,
    ceilingLights,
    onUpdateCeilingLight,
  ])

  return (
    <div className="app" onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <Controls
        settings={settings}
        onChange={setSettings}
        selectedLabel={selectedLabel}
        selectedRotationDeg={selectedRotationDeg}
        onResetFurniture={() => {
          setFurniture(structuredClone(INITIAL_FURNITURE))
          setSelectedId(null)
        }}
        onRotateSelected={onRotateSelected}
        onDeleteSelected={onDeleteSelected}
        onSaveSelectedToLibrary={onSaveSelectedToLibrary}
        libraryAssets={userLibrary}
        onPlaceLibraryAsset={onPlaceLibraryAsset}
        onDeleteLibraryAsset={onDeleteLibraryAsset}
        openingsEnabled={openingsEnabled}
        openingLayout={openingLayout}
        walls={walls}
        onToggleOpening={onToggleOpening}
        onSetAllOpenings={(enabled) => {
          const ids = listPlanOpenings(openingLayout, walls).map((o) => o.id)
          setOpeningsEnabled(Object.fromEntries(ids.map((id) => [id, enabled])))
        }}
        onResetOpenings={() => {
          if (defaultRooms) {
            setOpeningsEnabled({ ...DEFAULT_OPENING_STATE })
            setOpeningLayout({ ...DEFAULT_OPENING_LAYOUT })
            setPartitionsEnabled({ ...DEFAULT_PARTITION_STATE })
            setPartitionLayout(structuredClone(DEFAULT_PARTITION_LAYOUT))
          } else {
            setOpeningsEnabled({})
            setOpeningLayout({})
          }
        }}
        partitionsEnabled={partitionsEnabled}
        onTogglePartition={onTogglePartition}
        showDefaultRooms={defaultRooms}
        roomNames={roomNames}
        roomKinds={roomKinds}
        buildingOuterArea={building.w * building.d}
        plans={plans}
        plansReady={plansReady}
        plansError={plansError}
        activePlanId={activePlanId}
        onNewPlan={onNewPlan}
        onSavePlan={onSavePlan}
        onOverwritePlan={onOverwritePlan}
        onLoadPlan={onLoadPlan}
        onDeletePlan={onDeletePlan}
        onExportPlans={onExportPlans}
        onExportPdf={onExportPdf}
        onImportPlans={onImportPlans}
      />
      <main className="viewport">
        <Scene
          settings={settings}
          furniture={furniture}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onRotate={onRotate}
          onEditSize={onEditSize}
          dragging={dragging}
          walls={walls}
          building={building}
          useDefaultRooms={defaultRooms}
          openingsEnabled={openingsEnabled}
          openingLayout={openingLayout}
          partitionLayout={partitionLayout}
          partitionsEnabled={partitionsEnabled}
          roomNames={roomNames}
          roomKinds={roomKinds}
          ceilingLights={ceilingLights}
          onWalkLockChange={setWalkLocked}
        />
        {settings.walkMode && !walkLocked && (
          <div className="walk-overlay" aria-hidden>
            <p>Click to enter walk mode</p>
            <span>WASD · Shift sprint · Esc unlock</span>
        </div>
        )}
        {settings.showFloorPlan2D && (
          <div className="plan2d-overlay">
            <div className="plan2d-header">
              <span>Floor plan</span>
        <button
          type="button"
                className="plan2d-close"
                onClick={() => setSettings((s) => ({ ...s, showFloorPlan2D: false }))}
        >
                Close
        </button>
            </div>
            <FloorPlan2D
              furniture={furniture}
              walls={walls}
              building={building}
              useDefaultRooms={defaultRooms}
              showRoomDimensions={settings.showRoomDimensions}
              showInnerArea={settings.showInnerArea}
              showOuterArea={settings.showOuterArea}
              showWallLengths={settings.showWallLengths}
              showFurniture2D={settings.showFurniture2D !== false}
              onShowFurniture2DChange={(show) =>
                setSettings((s) => ({ ...s, showFurniture2D: show }))
              }
              showCompass={settings.showCompass !== false}
              onShowCompassChange={(show) =>
                setSettings((s) => ({ ...s, showCompass: show }))
              }
              northAngle={settings.northAngle}
              onNorthAngleChange={(angle) =>
                setSettings((s) => ({ ...s, northAngle: angle }))
              }
              compassU={settings.compassU}
              compassV={settings.compassV}
              onCompassPosChange={(u, v) =>
                setSettings((s) => ({ ...s, compassU: u, compassV: v }))
              }
              openingsEnabled={openingsEnabled}
              openingLayout={openingLayout}
              partitionLayout={partitionLayout}
              partitionsEnabled={partitionsEnabled}
              selectedId={selectedId}
              onSelect={onSelect}
              onMoveFurniture={onMoveQuiet}
              onResizeFurniture={onResizeFurniture}
              onRotateFurniture={onRotate}
              onPatchFurniture={(id, next) => {
                setFurniture((prev) =>
                  prev.map((item) => (item.id === id ? { ...item, ...next } : item)),
                )
              }}
              onEditSize={onEditSize}
              onUpdateOpening={onUpdateOpening}
              onEditOpening={onEditOpening}
              onAddOpening={onAddOpening}
              onRemoveOpening={onRemoveOpening}
              onAddWall={onAddWall}
              onUpdateWall={onUpdateWall}
              onRemoveWall={onRemoveWall}
              drawWallThickness={drawWallThickness}
              onDrawWallThicknessChange={setDrawWallThickness}
              roomNames={roomNames}
              roomKinds={roomKinds}
              onRenameRoom={(id, name) =>
                setRoomNames((prev) => {
                  const next = { ...prev }
                  const trimmed = name.trim()
                  if (!trimmed) delete next[id]
                  else next[id] = trimmed
                  return next
                })
              }
              onSetRoomKind={(id, kind) =>
                setRoomKinds((prev) => {
                  const next = { ...prev }
                  if (kind === 'room') delete next[id]
                  else next[id] = kind
                  return next
                })
              }
              onEditRoom={(id) => {
                setSelectedId(id)
                setSizeEditId(null)
                setOpeningEditId(null)
                setRoomEditId(id)
              }}
              onMovePartition={onMovePartition}
              ceilingLights={ceilingLights}
              onAddCeilingLight={onAddCeilingLight}
              onUpdateCeilingLight={onUpdateCeilingLight}
              onRemoveCeilingLight={onRemoveCeilingLight}
            />
        </div>
        )}
        {sizeEditItem && (
          <SizeEditModal
            label={sizeEditItem.label}
            size={sizeEditItem.size}
            elevation={sizeEditItem.position[1]}
            color={sizeEditItem.color ?? settings.furnitureColor}
            accentColor={sizeEditItem.accentColor ?? settings.accentColor}
            planIcon={sizeEditItem.planIcon ?? 'box'}
            onClose={() => setSizeEditId(null)}
            onApply={({ size, elevation, color, accentColor, planIcon }) => {
              const [x, , z] = sizeEditItem.position
              setFurniture((prev) =>
                prev.map((item) =>
                  item.id === sizeEditItem.id
                    ? {
                        ...item,
                        size,
                        position: [x, elevation, z],
                        color,
                        accentColor,
                        planIcon,
                      }
                    : item,
                ),
              )
              setSizeEditId(null)
            }}
          />
        )}
        {roomEditId && (
          <RoomEditModal
            roomId={roomEditId}
            name={roomNames[roomEditId] ?? ''}
            kind={normalizeRoomKind(roomKinds[roomEditId])}
            onClose={() => setRoomEditId(null)}
            onApply={({ name, kind }) => {
              setRoomNames((prev) => {
                const next = { ...prev }
                const trimmed = name.trim()
                if (!trimmed) delete next[roomEditId]
                else next[roomEditId] = trimmed
                return next
              })
              setRoomKinds((prev) => {
                const next = { ...prev }
                if (kind === 'room') delete next[roomEditId]
                else next[roomEditId] = kind
                return next
              })
              setRoomEditId(null)
            }}
          />
        )}
        {openingEdit && (
          <OpeningEditModal
            label={openingEdit.opening.label}
            kind={openingEdit.opening.kind}
            width={openingEdit.width}
            height={openingEdit.height}
            sill={openingEdit.sill}
            wallLength={openingEdit.wallLen}
            style={openingEdit.opening.style}
            onClose={() => setOpeningEditId(null)}
            onApply={({ width, height, sill, style }) => {
              const id = openingEdit.opening.id
              const mid = (openingEdit.opening.t0 + openingEdit.opening.t1) / 2
              const span = Math.min(0.98, width / openingEdit.wallLen)
              const t0 = Math.min(1 - span, Math.max(0, mid - span / 2))
              const t1 = Math.min(1, t0 + span)
              onUpdateOpening(id, {
                t0,
                t1,
                height,
                ...(openingEdit.opening.kind === 'window' ? { sill } : {}),
                ...(openingEdit.opening.kind === 'door'
                  ? {
                      style:
                        style === 'french'
                          ? 'french'
                          : style === 'gate'
                            ? 'gate'
                            : null,
                      label:
                        style === 'french'
                          ? 'French door'
                          : style === 'gate'
                            ? 'Gate'
                            : 'Door',
                    }
                  : {}),
              })
              setOpeningEditId(null)
            }}
          />
        )}
        <div className="viewport-hint">
          {settings.walkMode
            ? walkLocked
              ? 'WASD move · Shift sprint · Esc unlock · furniture edit disabled'
              : 'FPS walk on · click the view to look around'
            : 'Left/right-click select · drag move · double-click size/elev · R/Q rotate'}
        </div>
      </main>
    </div>
  )
}

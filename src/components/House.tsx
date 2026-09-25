import { useEffect, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import {
  BUILDING,
  PARTITION,
  ROOMS,
  roomApproxSize,
  wallsWithOpenings,
  findCustomRectangularRooms,
  PATIO_OPENING_H,
  wallMeshCenterOffset,
  wallCornerFills,
  customRoomFloorPolygon,
  terraceFenceWallIds,
  normalizeRoomKind,
  ROOM_KIND_LABEL,
  type BuildingBounds,
  type OpeningDef,
  type OpeningLayout,
  type PartitionLayout,
  type RoomDef,
  type RoomKind,
  type WallSeg,
} from '../data/floorPlan'
import { applyWorldFloorUVs, createWoodFloorMaps, createDeckFloorMaps } from '../lib/woodFloorTexture'
import { createTileFloorMaps } from '../lib/tileFloorTexture'

/** Flat label via canvas (no CDN font / Suspense). Parent has scale.x = -1, so flip text back. */
function DimLabel({
  position,
  text,
  scale = 1,
}: {
  position: [number, number, number]
  text: string
  scale?: number
}) {
  const map = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'bold 52px Segoe UI, Helvetica, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(255,255,255,0.92)'
    ctx.strokeText(text, 256, 64)
    ctx.fillStyle = '#1e3a8a'
    ctx.fillText(text, 256, 64)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }, [text])

  const w = 1.35 * scale
  const h = 0.34 * scale
  return (
    <sprite position={position} scale={[-w, h, 1]}>
      <spriteMaterial map={map} transparent depthTest={false} depthWrite={false} />
    </sprite>
  )
}

interface HouseProps {
  wallHeight: number
  wallColor: string
  floorColor: string
  tileColor: string
  walls: WallSeg[]
  building: BuildingBounds
  useDefaultRooms: boolean
  openingsEnabled: Record<string, boolean>
  openingLayout: OpeningLayout
  partitionLayout: PartitionLayout
  partitionsEnabled: Record<string, boolean>
  showDimensions: boolean
  showRoomDimensions?: boolean
  showInnerArea?: boolean
  showOuterArea?: boolean
  showWallLengths?: boolean
  /** Room name labels floating above the floor */
  showRoomNames?: boolean
  showDoorLeaves: boolean
  showRoof: boolean
  roomNames?: Record<string, string>
  roomKinds?: Record<string, RoomKind>
}

/** Two-slope gable roof — ridge east–west, slopes to north & south */
function GableRoof({
  wallHeight,
  wallColor,
  building,
}: {
  wallHeight: number
  wallColor: string
  building: BuildingBounds
}) {
  const overhang = 0.4
  const rise = 1.55
  const w = building.w + overhang * 2
  const d = building.d + overhang * 2
  const cx = building.centerX
  const cz = building.centerZ
  const baseY = wallHeight
  const halfW = w / 2
  const halfD = d / 2
  const roofColor = '#6a727c'
  const underColor = '#8a9098'

  const makeSlope = useMemo(() => {
    // Quad: eave (low) → ridge (high). Y up.
    const build = (
      zEave: number,
      zRidge: number,
    ): THREE.BufferGeometry => {
      const yEave = baseY
      const yRidge = baseY + rise
      const positions = new Float32Array([
        cx - halfW, yEave, zEave,
        cx + halfW, yEave, zEave,
        cx + halfW, yRidge, zRidge,
        cx - halfW, yRidge, zRidge,
      ])
      const indices = new Uint16Array([0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geo.setIndex(new THREE.BufferAttribute(indices, 1))
      geo.computeVertexNormals()
      return geo
    }
    return {
      south: build(cz - halfD, cz),
      north: build(cz + halfD, cz),
    }
  }, [baseY, rise, cx, cz, halfW, halfD])

  const gableGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-halfD, 0)
    shape.lineTo(halfD, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [halfD, rise])

  return (
    <group>
      <mesh geometry={makeSlope.south} castShadow receiveShadow>
        <meshStandardMaterial
          color={roofColor}
          roughness={0.88}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh geometry={makeSlope.north} castShadow receiveShadow>
        <meshStandardMaterial
          color={roofColor}
          roughness={0.88}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* ridge cap */}
      <mesh position={[cx, baseY + rise + 0.03, cz]} castShadow>
        <boxGeometry args={[w + 0.05, 0.06, 0.12]} />
        <meshStandardMaterial color="#555c66" roughness={0.75} />
      </mesh>
      {/* gable ends */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={gableGeo}
          position={[cx + side * (halfW - 0.02), baseY, cz]}
          rotation={[0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}
        >
          <meshStandardMaterial color={wallColor} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[cx, baseY + 0.02, cz]} receiveShadow>
        <boxGeometry args={[building.w + 0.1, 0.03, building.d + 0.1]} />
        <meshStandardMaterial color={underColor} roughness={0.95} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}


/** Expand room polygon toward walls so floors nearly meet under partitions (no overlap). */
function expandPolygon(polygon: [number, number][], amount: number): [number, number][] {
  let cx = 0
  let cz = 0
  for (const [x, z] of polygon) {
    cx += x
    cz += z
  }
  cx /= polygon.length
  cz /= polygon.length
  return polygon.map(([x, z]) => {
    const dx = x - cx
    const dz = z - cz
    const len = Math.hypot(dx, dz)
    if (len < 1e-6) return [x, z]
    return [x + (dx / len) * amount, z + (dz / len) * amount]
  })
}

/** Build an upward-facing floor mesh in XZ from [x,z] polygon points.
 *  Thin extrusion (not a zero-thickness plane) avoids slab z-fight at grazing angles. */
const FLOOR_THICKNESS = 0.03

function makeFloorGeometry(polygon: [number, number][], expand: number) {
  const expanded = expandPolygon(polygon, expand)
  const shape = new THREE.Shape()
  shape.moveTo(expanded[0][0], -expanded[0][1])
  for (let i = 1; i < expanded.length; i++) {
    shape.lineTo(expanded[i][0], -expanded[i][1])
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: FLOOR_THICKNESS,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1,
  })
  // Shape XY → floor XZ with +Y up; extrude depth becomes floor thickness
  geo.rotateX(-Math.PI / 2)
  applyWorldFloorUVs(geo)
  geo.computeVertexNormals()
  return geo
}

function Floor({
  polygon,
  color,
  kind = 'wood',
  woodMaps = null,
  tileMaps = null,
  deckMaps = null,
}: {
  polygon: [number, number][]
  color: string
  kind?: 'wood' | 'tile' | 'deck'
  woodMaps?: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null
  tileMaps?: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null
  deckMaps?: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } | null
}) {
  // Stay under the partition centreline — no wood/tile overlap (was causing joint flicker)
  const expand = PARTITION * 0.48
  // Sit clearly above the foundation top (y≈0) so depth buffer stays stable
  const y = kind === 'tile' ? 0.012 : kind === 'deck' ? 0.008 : 0.01
  const geometry = useMemo(
    () => makeFloorGeometry(polygon, expand),
    [polygon, expand],
  )

  const maps =
    kind === 'tile' ? tileMaps : kind === 'deck' ? deckMaps : woodMaps

  if (maps) {
    return (
      <mesh geometry={geometry} position={[0, y, 0]} receiveShadow castShadow={false}>
        <meshStandardMaterial
          map={maps.map}
          roughnessMap={maps.roughnessMap}
          roughness={kind === 'tile' ? 0.28 : kind === 'deck' ? 0.88 : 0.82}
          metalness={kind === 'tile' ? 0.08 : kind === 'deck' ? 0.04 : 0.02}
          // Opaque floors: no polygonOffset (that bias causes grazing shimmer)
          depthWrite
          depthTest
        />
      </mesh>
    )
  }

  return (
    <mesh geometry={geometry} position={[0, y, 0]} receiveShadow castShadow={false}>
      <meshStandardMaterial
        color={color}
        roughness={kind === 'tile' ? 0.35 : 0.55}
        metalness={kind === 'tile' ? 0.08 : 0.05}
        depthWrite
        depthTest
      />
    </mesh>
  )
}

function RoomTint({
  polygon,
  color,
}: {
  polygon: [number, number][]
  color: string
}) {
  // Tint uses unexpanded clear floor so wall gaps stay subtle and tint doesn't bleed under walls
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(polygon[0][0], -polygon[0][1])
    for (let i = 1; i < polygon.length; i++) {
      shape.lineTo(polygon[i][0], -polygon[i][1])
    }
    shape.closePath()
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [polygon])

  return (
    <mesh geometry={geometry} position={[0, 0.045, 0]} renderOrder={1}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.22}
        roughness={1}
        depthWrite={false}
        depthTest
      />
    </mesh>
  )
}

function DoorLeaf({
  wall,
  opening,
  wallHeight,
  allWalls,
}: {
  wall: WallSeg
  opening: OpeningDef
  wallHeight: number
  allWalls: WallSeg[]
}) {
  const [ax, az] = wall.a
  const [bx, bz] = wall.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz) || 1
  const wallRot = Math.atan2(dz, dx)
  const openLen = Math.max(0.3, (opening.t1 - opening.t0) * length)
  const midT = (opening.t0 + opening.t1) / 2
  const off = wallMeshCenterOffset(wall, allWalls)
  const ox = ax + dx * midT + off.x
  const oz = az + dz * midT + off.z
  const frameColor = '#c9b08a'

  // Closed double-frame patio door (2 glass panes + mullion)
  if (opening.style === 'french') {
    const doorH = Math.min(
      opening.height ?? PATIO_OPENING_H,
      wallHeight - 0.05,
    )
    const frame = 0.055
    const mullion = 0.05
    const thick = 0.05
    const paneW = Math.max(0.12, (openLen - frame * 2 - mullion) / 2)
    const paneH = Math.max(0.3, doorH - frame * 2)
    const leftX = -openLen / 2 + frame + paneW / 2
    const rightX = openLen / 2 - frame - paneW / 2

    return (
      <group position={[ox, 0, oz]} rotation={[0, wallRot, 0]}>
        {/* outer frame rails */}
        <mesh position={[0, frame / 2, 0]} castShadow>
          <boxGeometry args={[openLen, frame, thick]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} />
        </mesh>
        <mesh position={[0, doorH - frame / 2, 0]} castShadow>
          <boxGeometry args={[openLen, frame, thick]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} />
        </mesh>
        <mesh position={[-openLen / 2 + frame / 2, doorH / 2, 0]} castShadow>
          <boxGeometry args={[frame, doorH, thick]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} />
        </mesh>
        <mesh position={[openLen / 2 - frame / 2, doorH / 2, 0]} castShadow>
          <boxGeometry args={[frame, doorH, thick]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} />
        </mesh>
        {/* center mullion — two frames */}
        <mesh position={[0, doorH / 2, 0]} castShadow>
          <boxGeometry args={[mullion, doorH, thick]} />
          <meshStandardMaterial color={frameColor} roughness={0.45} />
        </mesh>
        {/* glass panes — thinner + depth bias so they don't flicker against the frame */}
        <mesh position={[leftX, frame + paneH / 2, 0]} renderOrder={3}>
          <boxGeometry args={[Math.max(0.08, paneW - 0.01), Math.max(0.08, paneH - 0.01), thick * 0.25]} />
          <meshStandardMaterial
            color="#9ec9e0"
            transparent
            opacity={0.32}
            roughness={0.12}
            metalness={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
        <mesh position={[rightX, frame + paneH / 2, 0]} renderOrder={3}>
          <boxGeometry args={[Math.max(0.08, paneW - 0.01), Math.max(0.08, paneH - 0.01), thick * 0.25]} />
          <meshStandardMaterial
            color="#9ec9e0"
            transparent
            opacity={0.32}
            roughness={0.12}
            metalness={0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
        {/* handles on both faces at mullion */}
        {([-1, 1] as const).map((side) => (
          <mesh
            key={side}
            position={[mullion * 0.6, doorH * 0.48, side * (thick / 2 + 0.02)]}
          >
            <boxGeometry args={[0.016, 0.1, 0.03]} />
            <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
    )
  }

  const doorH = Math.min(
    opening.height ?? Math.min(2.1, wallHeight * 0.78),
    wallHeight - 0.05,
  )
  const leafW = openLen - 0.03
  const thick = 0.045
  const wood = '#b8956a'
  const panel = '#a88860'

  return (
    <group position={[ox, 0, oz]} rotation={[0, wallRot, 0]}>
      {/* Closed slab — same finish on both faces */}
      <mesh position={[0, doorH / 2, 0]} castShadow>
        <boxGeometry args={[leafW, doorH, thick]} />
        <meshStandardMaterial color={wood} roughness={0.5} />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[0, doorH * 0.68, side * (thick / 2 + 0.005)]}>
            <boxGeometry args={[leafW * 0.7, doorH * 0.26, 0.01]} />
            <meshStandardMaterial color={panel} roughness={0.55} />
          </mesh>
          <mesh position={[0, doorH * 0.32, side * (thick / 2 + 0.005)]}>
            <boxGeometry args={[leafW * 0.7, doorH * 0.26, 0.01]} />
            <meshStandardMaterial color={panel} roughness={0.55} />
          </mesh>
          <mesh position={[leafW * 0.32, doorH * 0.48, side * (thick / 2 + 0.022)]}>
            <boxGeometry args={[0.018, 0.11, 0.035]} />
            <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function GlassWallMesh({ seg, height }: { seg: WallSeg; height: number }) {
  const [ax, az] = seg.a
  const [bx, bz] = seg.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return null
  const rotation = Math.atan2(dz, dx)
  const h = seg.screenHeight ?? height * 0.85
  const cx = (ax + bx) / 2
  const cz = (az + bz) / 2
  return (
    <mesh
      position={[cx, h / 2, cz]}
      rotation={[0, rotation, 0]}
      castShadow={false}
      receiveShadow={false}
      renderOrder={3}
    >
      <boxGeometry args={[Math.max(0.05, length - 0.02), Math.max(0.05, h - 0.02), Math.max(0.012, seg.thickness * 0.7)]} />
      <meshStandardMaterial
        color="#b8d4e8"
        transparent
        opacity={0.32}
        roughness={0.12}
        metalness={0.15}
        side={THREE.DoubleSide}
        depthWrite={false}
        depthTest
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  )
}

/** Open rail fence along a wall segment (terrace enclosure). */
function FenceMesh({
  seg,
  allWalls,
}: {
  seg: WallSeg
  allWalls: WallSeg[]
}) {
  const offset = useMemo(
    () => wallMeshCenterOffset(seg, allWalls),
    [seg, allWalls],
  )
  const [ax, az] = seg.a
  const [bx, bz] = seg.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  if (length < 0.05) return null
  const rotation = Math.atan2(dz, dx)
  const cx = (ax + bx) / 2 + offset.x
  const cz = (az + bz) / 2 + offset.z
  const openings = seg.openings ?? []
  const postH = 1.0
  const topRailY = 0.92
  const midRailY = 0.48
  const postStep = 1.1
  const postW = 0.055
  /** Half-width of a gate jamb post in wall param space — rails meet the post face. */
  const postHalfT = postW / 2 / length
  const nPosts = Math.max(2, Math.round(length / postStep) + 1)
  const metal = '#6e6860'

  const gateOpenings = openings.filter(
    (o) => o.kind === 'door' && o.style !== 'french',
  )
  const otherOpenings = openings.filter((o) => !gateOpenings.includes(o))

  /** Clear bay for a gate: between inner faces of jamb posts (posts sit on t0/t1). */
  const gateBays = gateOpenings.map((o) => {
    const t0 = Math.max(0, Math.min(1, o.t0))
    const t1 = Math.max(0, Math.min(1, o.t1))
    return {
      t0,
      t1,
      /** rail / post-clearance edges */
      cut0: Math.min(t1, t0 + postHalfT),
      cut1: Math.max(t0, t1 - postHalfT),
    }
  })

  const inGateBay = (t: number) =>
    gateBays.some((b) => t > b.cut0 + 1e-4 && t < b.cut1 - 1e-4)

  const inOtherOpening = (t: number) =>
    otherOpenings.some((o) => t > o.t0 + 0.01 && t < o.t1 - 0.01)

  const posts = new Set<number>()
  for (let i = 0; i < nPosts; i++) {
    const t = nPosts === 1 ? 0.5 : i / (nPosts - 1)
    if (!inGateBay(t) && !inOtherOpening(t)) posts.add(Number(t.toFixed(5)))
  }
  // Always put jamb posts at gate edges so the leaf sits flush between them
  for (const b of gateBays) {
    posts.add(Number(b.t0.toFixed(5)))
    posts.add(Number(b.t1.toFixed(5)))
  }
  // Keep ends
  posts.add(0)
  posts.add(1)

  const spans: [number, number][] = []
  {
    const cuts = [
      ...gateBays.map((b) => ({ t0: b.cut0, t1: b.cut1 })),
      ...otherOpenings.map((o) => ({
        t0: Math.max(0, o.t0),
        t1: Math.min(1, o.t1),
      })),
    ].sort((a, b) => a.t0 - b.t0)

    let cursor = 0
    for (const o of cuts) {
      if (o.t0 > cursor + 1e-4) spans.push([cursor, o.t0])
      cursor = Math.max(cursor, o.t1)
    }
    if (cursor < 1 - 1e-4) spans.push([cursor, 1])
    if (!spans.length && !cuts.length) spans.push([0, 1])
  }

  return (
    <group position={[cx, 0, cz]} rotation={[0, rotation, 0]}>
      {[...posts].map((t) => {
        const x = -length / 2 + t * length
        return (
          <mesh key={`p-${t}`} position={[x, postH / 2, 0]} castShadow>
            <boxGeometry args={[postW, postH, postW]} />
            <meshStandardMaterial color={metal} metalness={0.35} roughness={0.45} />
          </mesh>
        )
      })}
      {spans.map(([t0, t1], i) => {
        const segLen = (t1 - t0) * length
        if (segLen < 0.03) return null
        const x = -length / 2 + ((t0 + t1) / 2) * length
        // Rails run post-face to post-face (no extra shrink that opens light gaps)
        const railLen = Math.max(0.04, segLen)
        return (
          <group key={`r-${i}`}>
            <mesh position={[x, topRailY, 0]} castShadow>
              <boxGeometry args={[railLen, 0.04, 0.04]} />
              <meshStandardMaterial color={metal} metalness={0.35} roughness={0.45} />
            </mesh>
            <mesh position={[x, midRailY, 0]} castShadow>
              <boxGeometry args={[railLen, 0.03, 0.03]} />
              <meshStandardMaterial color={metal} metalness={0.35} roughness={0.45} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Metal terrace gate — sits flush between fence jamb posts. */
function GateLeaf({
  wall,
  opening,
  allWalls,
}: {
  wall: WallSeg
  opening: OpeningDef
  allWalls: WallSeg[]
}) {
  const [ax, az] = wall.a
  const [bx, bz] = wall.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz) || 1
  const wallRot = Math.atan2(dz, dx)
  const postW = 0.055
  const hingeGap = 0.012
  const rawOpen = Math.max(0.4, (opening.t1 - opening.t0) * length)
  // Clear width between inner faces of jamb posts, minus a tiny hinge/latch gap
  const openLen = Math.max(0.35, rawOpen - postW - hingeGap * 2)
  const midT = (opening.t0 + opening.t1) / 2
  const off = wallMeshCenterOffset(wall, allWalls)
  const ox = ax + dx * midT + off.x
  const oz = az + dz * midT + off.z
  // Match fence heights (post 1.0, top rail 0.92)
  const gateH = Math.min(1.0, opening.height ?? 1.0)
  const topRailY = 0.92
  const midRailY = 0.48
  const metal = '#6e6860'
  const frame = 0.04
  const barN = Math.max(3, Math.round(openLen / 0.12))
  const innerW = Math.max(0.15, openLen - frame * 2)
  const innerH = Math.max(0.2, gateH - frame * 2)

  return (
    <group position={[ox, 0, oz]} rotation={[0, wallRot, 0]}>
      {/* outer frame — same depth/color as fence rails */}
      <mesh position={[0, frame / 2, 0]} castShadow>
        <boxGeometry args={[openLen, frame, 0.04]} />
        <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, topRailY, 0]} castShadow>
        <boxGeometry args={[openLen, 0.04, 0.04]} />
        <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[-openLen / 2 + frame / 2, gateH / 2, 0]} castShadow>
        <boxGeometry args={[frame, gateH, 0.04]} />
        <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[openLen / 2 - frame / 2, gateH / 2, 0]} castShadow>
        <boxGeometry args={[frame, gateH, 0.04]} />
        <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* mid rail aligned with fence */}
      <mesh position={[0, midRailY, 0]} castShadow>
        <boxGeometry args={[innerW, 0.03, 0.035]} />
        <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
      </mesh>
      {/* vertical bars */}
      {Array.from({ length: barN }, (_, i) => {
        const t = barN === 1 ? 0.5 : i / (barN - 1)
        const x = -innerW / 2 + t * innerW
        return (
          <mesh key={i} position={[x, frame + innerH / 2, 0]} castShadow>
            <boxGeometry args={[0.022, innerH, 0.022]} />
            <meshStandardMaterial color={metal} metalness={0.4} roughness={0.4} />
          </mesh>
        )
      })}
      {/* latch */}
      <mesh position={[openLen / 2 - frame - 0.02, midRailY + 0.04, 0.03]} castShadow>
        <boxGeometry args={[0.04, 0.1, 0.05]} />
        <meshStandardMaterial color="#8a8580" metalness={0.55} roughness={0.35} />
      </mesh>
    </group>
  )
}

function WallMesh({
  seg,
  height,
  color,
  openings,
  allWalls,
}: {
  seg: WallSeg
  height: number
  color: string
  openings: OpeningDef[]
  allWalls: WallSeg[]
}) {
  const offset = useMemo(
    () => wallMeshCenterOffset(seg, allWalls),
    [seg, allWalls],
  )
  const parts = useMemo(
    () => buildWallParts(seg, height, openings, offset),
    [seg, height, openings, offset],
  )

  return (
    <group>
      {parts.map((p, i) => (
        <mesh
          key={`${seg.id}-${i}`}
          position={p.position}
          rotation={[0, p.rotation, 0]}
          castShadow={!p.glass}
          receiveShadow={!p.glass}
          renderOrder={p.glass ? 3 : 0}
        >
          <boxGeometry args={[p.width, p.height, p.depth]} />
          <meshStandardMaterial
            color={p.glass ? '#a8d4e8' : color}
            roughness={p.glass ? 0.12 : 0.9}
            metalness={p.glass ? 0.15 : 0}
            transparent={!!p.glass}
            opacity={p.glass ? 0.28 : 1}
            side={p.glass ? THREE.DoubleSide : THREE.FrontSide}
            depthWrite={!p.glass}
            depthTest
            polygonOffset={!!p.glass}
            polygonOffsetFactor={p.glass ? -1 : 0}
            polygonOffsetUnits={p.glass ? -1 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

interface WallPart {
  position: [number, number, number]
  rotation: number
  width: number
  height: number
  depth: number
  glass?: boolean
}

function buildWallParts(
  seg: WallSeg,
  height: number,
  openings: OpeningDef[],
  offset: { x: number; z: number } = { x: 0, z: 0 },
): WallPart[] {
  const [ax, az] = seg.a
  const [bx, bz] = seg.b
  const dx = bx - ax
  const dz = bz - az
  const length = Math.hypot(dx, dz)
  if (length < 0.01) return []

  const rotation = Math.atan2(dz, dx)
  const thick = seg.thickness
  const sorted = [...openings].sort((a, b) => a.t0 - b.t0)
  const parts: WallPart[] = []
  const ox0 = offset.x
  const oz0 = offset.z

  let cursor = 0
  for (const open of sorted) {
    const t0 = Math.max(0, Math.min(1, open.t0))
    const t1 = Math.max(0, Math.min(1, open.t1))
    if (t0 > cursor) {
      const segLen = (t0 - cursor) * length
      const cx = ax + dx * ((cursor + t0) / 2) + ox0
      const cz = az + dz * ((cursor + t0) / 2) + oz0
      parts.push({
        position: [cx, height / 2, cz],
        rotation,
        width: segLen,
        height,
        depth: thick,
      })
    }

    const openLen = (t1 - t0) * length
    const ox = ax + dx * ((t0 + t1) / 2) + ox0
    const oz = az + dz * ((t0 + t1) / 2) + oz0

    if (open.kind === 'door') {
      const isFrench = open.style === 'french'
      const doorH = Math.min(
        open.height ??
          (isFrench ? PATIO_OPENING_H : Math.min(2.1, height * 0.78)),
        height - 0.05,
      )
      const lintelH = Math.max(0.05, height - doorH)
      if (lintelH > 0.05) {
        parts.push({
          position: [ox, doorH + lintelH / 2, oz],
          rotation,
          width: openLen,
          height: lintelH,
          depth: thick,
        })
      }
      // Door leaves are rendered separately as DoorLeaf meshes
    } else {
      const sill = open.sill ?? 0.9
      const defaultWinH = Math.min(1.4, Math.max(0.2, height - sill - 0.25))
      const winH = Math.min(
        open.height ?? defaultWinH,
        Math.max(0.2, height - sill - 0.12),
      )
      const headerH = Math.max(0.05, height - sill - winH)
      const isDisplay = open.style === 'display'

      if (sill > 0.05) {
        parts.push({
          position: [ox, sill / 2, oz],
          rotation,
          width: openLen,
          height: sill,
          depth: thick,
        })
      }
      parts.push({
        position: [ox, sill + winH / 2, oz],
        rotation,
        // Inset from sill/header/jambs so edges aren't coplanar (stops z-fight flicker)
        width: Math.max(0.12, openLen - 0.03),
        height: Math.max(0.12, winH - 0.03),
        depth: Math.max(0.03, thick * (isDisplay ? 0.32 : 0.28)),
        glass: true,
      })
      if (headerH > 0.05) {
        parts.push({
          position: [ox, sill + winH + headerH / 2, oz],
          rotation,
          width: openLen,
          height: headerH,
          depth: thick,
        })
      }
    }

    cursor = t1
  }

  if (cursor < 1) {
    const segLen = (1 - cursor) * length
    const cx = ax + dx * ((cursor + 1) / 2) + ox0
    const cz = az + dz * ((cursor + 1) / 2) + oz0
    parts.push({
      position: [cx, height / 2, cz],
      rotation,
      width: segLen,
      height,
      depth: thick,
    })
  }

  return parts
}

function RoomDimensions({ room }: { room: RoomDef }) {
  const size = useMemo(() => roomApproxSize(room.polygon), [room.polygon])
  const y = 0.08
  const { minX, maxX, minZ, maxZ, cx, cz, width, depth } = size
  const tick = 0.12
  const offset = 0.28

  // Prefer plan clear sizes when set; fall back to bbox
  const widthM = room.width || width
  const depthM = room.length || depth
  const widthCm = `${(widthM * 100).toFixed(0)} cm`
  const depthCm = `${(depthM * 100).toFixed(0)} cm`
  const centerLabel = `${(depthM * 100).toFixed(0)} × ${(widthM * 100).toFixed(0)} cm`

  const widthLine = useMemo(() => {
    const pts = new Float32Array([minX, y, minZ - offset, maxX, y, minZ - offset])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return geo
  }, [minX, maxX, minZ, y, offset])

  const depthLine = useMemo(() => {
    const pts = new Float32Array([minX - offset, y, minZ, minX - offset, y, maxZ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3))
    return geo
  }, [minX, minZ, maxZ, y, offset])

  return (
    <group>
      <lineSegments geometry={widthLine}>
        <lineBasicMaterial color="#1d4ed8" />
      </lineSegments>
      <lineSegments geometry={depthLine}>
        <lineBasicMaterial color="#1d4ed8" />
      </lineSegments>
      <mesh position={[minX, y, minZ - offset]}>
        <boxGeometry args={[0.02, 0.02, tick]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[maxX, y, minZ - offset]}>
        <boxGeometry args={[0.02, 0.02, tick]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[minX - offset, y, minZ]}>
        <boxGeometry args={[tick, 0.02, 0.02]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[minX - offset, y, maxZ]}>
        <boxGeometry args={[tick, 0.02, 0.02]} />
        <meshBasicMaterial color="#1d4ed8" />
      </mesh>

      <DimLabel position={[cx, y + 0.02, minZ - offset - 0.12]} text={widthCm} scale={Math.min(1.4, widthM / 2.2)} />
      <DimLabel position={[minX - offset - 0.12, y + 0.02, cz]} text={depthCm} scale={Math.min(1.4, depthM / 2.8)} />
      <DimLabel position={[cx, 0.05, cz]} text={centerLabel} scale={Math.min(1.6, Math.min(widthM, depthM) / 1.8)} />
    </group>
  )
}

export default function House({
  wallHeight,
  wallColor,
  floorColor,
  tileColor,
  walls: wallSource,
  building,
  useDefaultRooms,
  openingsEnabled,
  openingLayout,
  partitionLayout,
  partitionsEnabled,
  showDimensions,
  showRoomDimensions = true,
  showInnerArea = true,
  showOuterArea = false,
  showWallLengths = false,
  showRoomNames = true,
  showDoorLeaves,
  showRoof,
  roomNames = {},
  roomKinds = {},
}: HouseProps) {
  const walls = wallsWithOpenings(
    wallSource,
    openingLayout,
    openingsEnabled,
    partitionLayout,
    partitionsEnabled,
  )

  const customRooms = useMemo(
    () => (useDefaultRooms ? [] : findCustomRectangularRooms(wallSource)),
    [useDefaultRooms, wallSource],
  )
  const fenceIds = useMemo(
    () => terraceFenceWallIds(customRooms, roomKinds),
    [customRooms, roomKinds],
  )

  const woodMaps = useMemo(() => createWoodFloorMaps(floorColor), [floorColor])
  const tileMaps = useMemo(() => createTileFloorMaps(tileColor), [tileColor])
  const deckMaps = useMemo(() => createDeckFloorMaps('#9a8b74'), [])
  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    const aniso = Math.min(16, gl.capabilities.getMaxAnisotropy())
    for (const maps of [woodMaps, tileMaps, deckMaps]) {
      for (const tex of [maps.map, maps.roughnessMap]) {
        if (tex.anisotropy !== aniso) {
          tex.anisotropy = aniso
          tex.needsUpdate = true
        }
      }
    }
  }, [gl, woodMaps, tileMaps, deckMaps])
  useEffect(() => {
    return () => {
      woodMaps.map.dispose()
      woodMaps.roughnessMap.dispose()
      tileMaps.map.dispose()
      tileMaps.roughnessMap.dispose()
      deckMaps.map.dispose()
      deckMaps.roughnessMap.dispose()
    }
  }, [woodMaps, tileMaps, deckMaps])

  return (
    <group>
      {useDefaultRooms ? (
        <mesh position={[building.centerX, -0.06, building.centerZ]} receiveShadow>
          <boxGeometry args={[building.w + 0.35, 0.12, building.d + 0.35]} />
          <meshStandardMaterial color="#6b6560" roughness={1} />
        </mesh>
      ) : (
        // Only registered rooms get a foundation — never fill the wall AABB
        // (L-shapes / terraces would otherwise pave empty corners).
        // Pad overhangs the yard hole so lawn tucks under the edge (no bright ring).
        customRooms.map((room) => {
          const { minX, minZ, w, d } = room.outer
          return (
            <mesh
              key={`slab-${room.id}`}
              position={[minX + w / 2, -0.06, minZ + d / 2]}
              receiveShadow
            >
              <boxGeometry args={[w + 0.16, 0.12, d + 0.16]} />
              <meshStandardMaterial color="#6b6560" roughness={1} />
            </mesh>
          )
        })
      )}

      {useDefaultRooms && (
        <mesh position={[HALL_PAD_X, -0.06, -0.55]} receiveShadow>
          <boxGeometry args={[1.2, 0.06, 1.0]} />
          <meshStandardMaterial color="#8a8278" roughness={1} />
        </mesh>
      )}

      {useDefaultRooms
        ? ROOMS.map((room) => (
            <Floor
              key={room.id}
              polygon={room.polygon}
              color={room.floorKind === 'tile' ? tileColor : floorColor}
              kind={room.floorKind === 'tile' ? 'tile' : 'wood'}
              woodMaps={woodMaps}
              tileMaps={tileMaps}
              deckMaps={deckMaps}
            />
          ))
        : customRooms.map((room) => {
            const kind = normalizeRoomKind(roomKinds[room.id])
            const floorKind = kind === 'bath' ? 'tile' : kind === 'terrace' ? 'deck' : 'wood'
            return (
              <Floor
                key={`floor-${room.id}`}
                polygon={customRoomFloorPolygon(room)}
                color={floorKind === 'tile' ? tileColor : floorColor}
                kind={floorKind}
                woodMaps={woodMaps}
                tileMaps={tileMaps}
                deckMaps={deckMaps}
              />
            )
          })}

      {useDefaultRooms &&
        ROOMS.map((room) => (
          <RoomTint key={`${room.id}-tint`} polygon={room.polygon} color={room.color} />
        ))}

      {walls.map((seg) =>
        seg.glass ? (
          <GlassWallMesh key={seg.id} seg={seg} height={wallHeight} />
        ) : fenceIds.has(seg.id) ? (
          <FenceMesh key={seg.id} seg={seg} allWalls={walls} />
        ) : (
          <WallMesh
            key={seg.id}
            seg={seg}
            height={wallHeight}
            color={wallColor}
            openings={seg.openings ?? []}
            allWalls={walls}
          />
        ),
      )}

      {/* Outer-corner fills: where both bodies sit outside a turn the drawn lines meet
          at the inner corner and a t×t notch is left — fill it (same rule as the 2D plan) */}
      {!useDefaultRooms &&
        wallCornerFills(walls).map((f, i) => {
          if (fenceIds.has(f.wallIds[0]) || fenceIds.has(f.wallIds[1])) return null
          const xs = f.corners.map((c) => c[0])
          const zs = f.corners.map((c) => c[1])
          const minX = Math.min(...xs)
          const maxX = Math.max(...xs)
          const minZ = Math.min(...zs)
          const maxZ = Math.max(...zs)
          const sx = maxX - minX
          const sz = maxZ - minZ
          if (sx < 1e-3 || sz < 1e-3) return null
          return (
            <mesh
              key={`corner-${f.wallIds[0]}-${f.wallIds[1]}-${i}`}
              position={[(minX + maxX) / 2, wallHeight / 2, (minZ + maxZ) / 2]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[sx, wallHeight, sz]} />
              <meshStandardMaterial color={wallColor} roughness={0.92} />
            </mesh>
          )
        })}

      {showDoorLeaves &&
        walls.flatMap((seg) =>
          (seg.openings ?? [])
            .filter((o) => o.kind === 'door')
            .map((o) =>
              o.style === 'gate' || (fenceIds.has(seg.id) && o.style !== 'french') ? (
                <GateLeaf key={o.id} wall={seg} opening={o} allWalls={walls} />
              ) : (
                <DoorLeaf
                  key={o.id}
                  wall={seg}
                  opening={o}
                  wallHeight={wallHeight}
                  allWalls={walls}
                />
              ),
            ),
        )}

      {showRoomNames &&
        useDefaultRooms &&
        ROOMS.map((room) => (
          <DimLabel
            key={`name-${room.id}`}
            position={[room.labelAt[0], 0.08, room.labelAt[1] - 0.35]}
            text={room.name}
            scale={Math.min(1.6, Math.min(room.width, room.length) / 2)}
          />
        ))}

      {showRoomDimensions &&
        useDefaultRooms &&
        ROOMS.map((room) => (
          <RoomDimensions key={`dim-${room.id}`} room={room} />
        ))}

      {!useDefaultRooms &&
        customRooms.map((room) => {
          const kind = normalizeRoomKind(roomKinds[room.id])
          const label = roomNames[room.id] || ROOM_KIND_LABEL[kind]
          return (
          <group key={room.id}>
            {showRoomNames && (
              <DimLabel
                position={[room.labelAt[0], 0.08, room.labelAt[1] - 0.35]}
                text={label}
                scale={Math.min(1.6, Math.min(room.span.w, room.span.d) / 2)}
              />
            )}
            {showRoomDimensions && (
              <>
                <DimLabel
                  position={[
                    room.inner.minX + room.inner.w / 2,
                    0.08,
                    room.inner.minZ - 0.4,
                  ]}
                  text={`${(room.inner.w * 100).toFixed(0)} cm`}
                  scale={Math.min(1.4, room.inner.w / 3)}
                />
                <DimLabel
                  position={[
                    room.inner.minX - 0.4,
                    0.08,
                    room.inner.minZ + room.inner.d / 2,
                  ]}
                  text={`${(room.inner.d * 100).toFixed(0)} cm`}
                  scale={Math.min(1.4, room.inner.d / 3)}
                />
                <DimLabel
                  position={[room.labelAt[0], 0.08, room.labelAt[1]]}
                  text={`${(room.inner.d * 100).toFixed(0)} × ${(room.inner.w * 100).toFixed(0)} cm`}
                  scale={Math.min(1.5, Math.min(room.inner.w, room.inner.d) / 2.2)}
                />
              </>
            )}
            {showInnerArea && (
              <DimLabel
                position={[
                  room.labelAt[0],
                  0.08,
                  room.labelAt[1] + (showRoomDimensions ? 0.35 : 0),
                ]}
                text={`Inner ${room.inner.area.toFixed(1)} m²`}
                scale={Math.min(1.5, Math.min(room.span.w, room.span.d) / 2.2)}
              />
            )}
            {showOuterArea && (
              <DimLabel
                position={[
                  room.labelAt[0],
                  0.08,
                  room.labelAt[1] +
                    (showRoomDimensions ? 0.35 : 0) +
                    (showInnerArea ? 0.35 : 0),
                ]}
                text={`Outer ${room.outer.area.toFixed(1)} m²`}
                scale={Math.min(1.4, Math.min(room.span.w, room.span.d) / 2.4)}
              />
            )}
          </group>
          )
        })}

      {showRoof && (
        <GableRoof wallHeight={wallHeight} wallColor={wallColor} building={building} />
      )}
    </group>
  )
}

const HALL_PAD_X = 5.0

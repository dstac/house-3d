import { useMemo } from 'react'
import * as THREE from 'three'
import { Sky, Environment } from '@react-three/drei'
import { BUILDING, type BuildingBounds, type CustomRoomMeasure } from '../data/floorPlan'

function createGrassMap() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#5a7a48'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const tone = 70 + Math.floor(Math.random() * 50)
    const g = 95 + Math.floor(Math.random() * 55)
    ctx.fillStyle = `rgb(${tone * 0.55},${g},${tone * 0.4})`
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3)
  }

  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 12 + Math.random() * 28
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(90, 120, 55, 0.35)')
    grad.addColorStop(1, 'rgba(90, 120, 55, 0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(14, 14)
  map.anisotropy = 4
  map.needsUpdate = true
  return map
}

function createPatioMap() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cell = size / 4
  ctx.fillStyle = '#8a8580'
  ctx.fillRect(0, 0, size, size)
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = col * cell + 2
      const y = row * cell + 2
      const tone = 130 + ((row + col) % 2) * 12
      ctx.fillStyle = `rgb(${tone},${tone - 4},${tone - 10})`
      ctx.fillRect(x, y, cell - 4, cell - 4)
    }
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(3, 5)
  map.anisotropy = 4
  map.needsUpdate = true
  return map
}

/** Ground ring with holes for building footprints (house-local XZ).
 *  `clearance` expands the hole (positive) or shrinks it (negative).
 *  Prefer a hole slightly smaller than the foundation so grass tucks under the slab
 *  — a larger hole leaves a bright empty ring around the perimeter. */
function makeYardGeometry(
  footprints: { minX: number; minZ: number; w: number; d: number }[],
  clearance: number,
  extent: number,
  centerX: number,
  centerZ: number,
) {
  const shape = new THREE.Shape()
  // Outer bounds in shape space (x, -z) → mesh (x, 0, z)
  shape.moveTo(centerX - extent, -(centerZ - extent))
  shape.lineTo(centerX + extent, -(centerZ - extent))
  shape.lineTo(centerX + extent, -(centerZ + extent))
  shape.lineTo(centerX - extent, -(centerZ + extent))
  shape.closePath()

  for (const fp of footprints) {
    const hole = new THREE.Path()
    const x0 = fp.minX - clearance
    const x1 = fp.minX + fp.w + clearance
    const z0 = fp.minZ - clearance
    const z1 = fp.minZ + fp.d + clearance
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) continue
    // Opposite winding from outer
    hole.moveTo(x0, -z0)
    hole.lineTo(x0, -z1)
    hole.lineTo(x1, -z1)
    hole.lineTo(x1, -z0)
    hole.closePath()
    shape.holes.push(hole)
  }

  const geo = new THREE.ShapeGeometry(shape)
  geo.rotateX(-Math.PI / 2)
  return geo
}

function Hedge({
  position,
  size,
}: {
  position: [number, number, number]
  size: [number, number, number]
}) {
  const [w, h, d] = size
  return (
    <group position={position}>
      <mesh position={[0, h * 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h * 0.9, d]} />
        <meshStandardMaterial color="#3d5c38" roughness={0.95} />
      </mesh>
      <mesh position={[0, h * 0.92, 0]} castShadow>
        <boxGeometry args={[w * 0.92, h * 0.22, d * 0.92]} />
        <meshStandardMaterial color="#4a6e42" roughness={0.92} />
      </mesh>
    </group>
  )
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 1.1, 8]} />
        <meshStandardMaterial color="#6b4e32" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.75, 14, 12]} />
        <meshStandardMaterial color="#3f6b3a" roughness={0.88} />
      </mesh>
      <mesh position={[0.35, 1.85, -0.15]} castShadow>
        <sphereGeometry args={[0.45, 12, 10]} />
        <meshStandardMaterial color="#4d7a45" roughness={0.88} />
      </mesh>
      <mesh position={[-0.3, 1.75, 0.2]} castShadow>
        <sphereGeometry args={[0.4, 12, 10]} />
        <meshStandardMaterial color="#355f32" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Sky / fog / HDR — world space, no geometry over the plan. */
export function SiteSky() {
  return (
    <>
      <Sky
        sunPosition={[12, 18, -6]}
        turbidity={4.5}
        rayleigh={0.85}
        mieCoefficient={0.006}
        mieDirectionalG={0.75}
        inclination={0.48}
        azimuth={0.22}
      />
      <Environment preset="park" environmentIntensity={0.45} />
      <fog attach="fog" args={['#b9c8d4', 32, 85]} />
    </>
  )
}

/**
 * Yard dressing in house-local coordinates.
 * Default apartment: grass ring with a hole under the rectangular footprint.
 * Custom plans: continuous lawn (no hole) — punching an AABB hole around
 * L-shapes / terraces left a bright empty plane in the missing corner.
 * Room foundations sit on top of the lawn instead.
 */
export default function SiteYard({
  building = BUILDING,
  useDefaultRooms = true,
  customRooms: _customRooms = [],
}: {
  building?: BuildingBounds
  useDefaultRooms?: boolean
  customRooms?: CustomRoomMeasure[]
}) {
  const footprints = useMemo(() => {
    if (!useDefaultRooms) return []
    return [
      {
        minX: building.minX,
        minZ: building.minZ,
        w: building.w,
        d: building.d,
      },
    ]
  }, [useDefaultRooms, building])

  const grassMap = useMemo(() => createGrassMap(), [])
  const patioMap = useMemo(() => createPatioMap(), [])
  // Default: slight inset hole so lawn tucks under the foundation edge.
  // Custom: no holes (empty footprints) → solid lawn everywhere.
  const yardGeo = useMemo(
    () =>
      makeYardGeometry(footprints, -0.12, 42, building.centerX, building.centerZ),
    [footprints, building.centerX, building.centerZ],
  )
  const nearGeo = useMemo(
    () =>
      makeYardGeometry(footprints, -0.08, 12, building.centerX, building.centerZ),
    [footprints, building.centerX, building.centerZ],
  )

  const { w, d, centerX, centerZ } = building
  const gap = 1.35 // clear space between walls and hedges/trees

  return (
    <group>
      {/* Far grass — below slab bottom to avoid coplanar edges */}
      <mesh geometry={yardGeo} position={[0, -0.14, 0]} receiveShadow>
        <meshStandardMaterial
          map={grassMap}
          roughness={0.95}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Near lawn ring */}
      <mesh geometry={nearGeo} position={[0, -0.125, 0]} receiveShadow>
        <meshStandardMaterial
          color="#6a8a55"
          roughness={0.96}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* Living terrace — only for default apartment */}
      {useDefaultRooms &&
        (() => {
          // West wall: t=0 at north (z=D), t=1 at south (z=0)
          const zNorth = d * (1 - 0.36) // display window north edge
          const zSouth = 0.08 // SW corner of house
          const terraceDepth = 2.45
          const terraceLen = zNorth - zSouth
          const wallOuterX = 0.02 // just outside west exterior face
          const cx = -terraceDepth / 2 - wallOuterX
          const cz = (zNorth + zSouth) / 2
          return (
            <group>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[cx, -0.06, cz]}
                receiveShadow
              >
                <planeGeometry args={[terraceDepth, terraceLen]} />
                <meshStandardMaterial map={patioMap} roughness={0.72} metalness={0.06} />
              </mesh>
              {/* raised deck edge / curb */}
              <mesh position={[cx, -0.02, cz]} castShadow receiveShadow>
                <boxGeometry args={[terraceDepth, 0.06, terraceLen]} />
                <meshStandardMaterial color="#8a8580" roughness={0.8} />
              </mesh>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[cx, 0.012, cz]}
                receiveShadow
              >
                <planeGeometry args={[terraceDepth - 0.08, terraceLen - 0.08]} />
                <meshStandardMaterial map={patioMap} roughness={0.7} metalness={0.05} />
              </mesh>
              {/* simple outer rail posts */}
              {Array.from({ length: 5 }, (_, i) => {
                const t = i / 4
                const z = zSouth + 0.15 + t * (terraceLen - 0.3)
                return (
                  <mesh key={i} position={[-terraceDepth - wallOuterX + 0.08, 0.45, z]} castShadow>
                    <boxGeometry args={[0.05, 0.9, 0.05]} />
                    <meshStandardMaterial color="#6e6860" metalness={0.35} roughness={0.45} />
                  </mesh>
                )
              })}
              <mesh
                position={[-terraceDepth - wallOuterX + 0.08, 0.88, cz]}
                castShadow
              >
                <boxGeometry args={[0.04, 0.04, terraceLen - 0.2]} />
                <meshStandardMaterial color="#6e6860" metalness={0.35} roughness={0.45} />
              </mesh>
            </group>
          )
        })()}

      {/* Entrance path — south of the building only (default apartment) */}
      {useDefaultRooms && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[5.0, -0.085, -2.15]}
          receiveShadow
        >
          <planeGeometry args={[2.2, 3.6]} />
          <meshStandardMaterial color="#9a958c" roughness={0.9} />
        </mesh>
      )}

      {/* Boundary hedges outside clearance */}
      <Hedge
        position={[centerX, 0, building.minZ + d + gap + 0.25]}
        size={[w + gap * 1.2, 1.1, 0.4]}
      />
      {useDefaultRooms ? (
        <Hedge
          position={[-gap - 0.25, 0, building.minZ + d * 0.78]}
          size={[0.4, 1.0, d * 0.35]}
        />
      ) : (
        <Hedge
          position={[building.minX - gap - 0.25, 0, centerZ]}
          size={[0.4, 1.0, d + gap]}
        />
      )}
      <Hedge
        position={[building.minX + w + gap + 0.2, 0, centerZ]}
        size={[0.4, 1.0, d + gap]}
      />
      <Hedge
        position={[centerX - (useDefaultRooms ? 2.6 : 0), 0, building.minZ - gap - 0.15]}
        size={[useDefaultRooms ? w * 0.45 : w + gap, 0.85, 0.35]}
      />
      {useDefaultRooms && (
        <Hedge
          position={[centerX + 2.8, 0, building.minZ - gap - 0.15]}
          size={[w * 0.35, 0.85, 0.35]}
        />
      )}

      {/* Trees — corners outside the footprint / terrace */}
      <Tree position={[building.minX - gap - 2.8, 0, building.minZ + d + gap + 0.6]} scale={1.1} />
      <Tree position={[building.minX + w + gap + 1.0, 0, building.minZ + d + gap + 0.4]} scale={1.0} />
      <Tree position={[building.minX - gap - 2.6, 0, building.minZ - gap - 1.2]} scale={0.85} />
      <Tree position={[building.minX + w + gap + 1.1, 0, building.minZ - gap - 0.8]} scale={0.95} />
    </group>
  )
}

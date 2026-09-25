import { useMemo } from 'react'
import * as THREE from 'three'
import {
  normalizeRoomKind,
  type BuildingBounds,
  type CeilingLightDef,
  type CustomRoomMeasure,
  type RoomKind,
} from '../data/floorPlan'

function StripLight({
  light,
  ceilingY,
}: {
  light: CeilingLightDef
  ceilingY: number
}) {
  const [len, width] = light.size
  const y = ceilingY - 0.03
  return (
    <group position={[light.position[0], y, light.position[1]]} rotation={[0, light.rotation, 0]}>
      {/* Housing */}
      <mesh castShadow={false} receiveShadow={false}>
        <boxGeometry args={[len, 0.04, Math.max(0.05, width + 0.02)]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Emissive diffuser */}
      <mesh position={[0, -0.022, 0]} >
        <boxGeometry args={[len * 0.96, 0.012, Math.max(0.04, width)]} />
        <meshStandardMaterial
          color="#fff6e0"
          emissive="#ffe9b0"
          emissiveIntensity={2.2}
          roughness={0.4}
        />
      </mesh>
      <pointLight
        position={[0, -0.15, 0]}
        intensity={1.1}
        distance={Math.max(4, len * 2.2)}
        decay={2}
        color="#fff2d6"
        castShadow={false}
      />
    </group>
  )
}

function IndustrialPendant({
  light,
  ceilingY,
}: {
  light: CeilingLightDef
  ceilingY: number
}) {
  const dia = Math.max(0.22, light.size[0])
  const drop = Math.min(1.6, Math.max(0.35, light.drop ?? 0.9))
  const shadeH = dia * 0.55
  const cableLen = drop
  const shadeY = ceilingY - cableLen
  const bulbY = shadeY - shadeH * 0.15

  return (
    <group position={[light.position[0], 0, light.position[1]]} rotation={[0, light.rotation, 0]}>
      <mesh position={[0, ceilingY - 0.015, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.03, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, ceilingY - cableLen / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, cableLen, 8]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      <mesh position={[0, shadeY, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[dia * 0.22, dia * 0.5, shadeH, 24, 1, true]} />
        <meshStandardMaterial
          color="#4a4f52"
          metalness={0.75}
          roughness={0.28}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, shadeY, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[dia * 0.2, dia * 0.48, shadeH * 0.98, 24, 1, true]} />
        <meshStandardMaterial
          color="#f0ebe3"
          roughness={0.85}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh position={[0, bulbY, 0]}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshStandardMaterial
          color="#fff8e8"
          emissive="#ffe6a8"
          emissiveIntensity={2.8}
          roughness={0.35}
        />
      </mesh>
      <pointLight
        position={[0, bulbY - 0.05, 0]}
        intensity={1.35}
        distance={7}
        decay={2}
        color="#ffefd0"
        castShadow={false}
      />
    </group>
  )
}

function FlushGlobe({
  light,
  ceilingY,
}: {
  light: CeilingLightDef
  ceilingY: number
}) {
  const dia = Math.max(0.18, light.size[0])
  const y = ceilingY - 0.04
  return (
    <group position={[light.position[0], y, light.position[1]]} rotation={[0, light.rotation, 0]}>
      <mesh>
        <sphereGeometry args={[dia * 0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial
          color="#f7f4ee"
          emissive="#ffe9c4"
          emissiveIntensity={1.6}
          roughness={0.55}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[dia * 0.22, dia * 0.22, 0.03, 16]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.7} />
      </mesh>
      <pointLight
        position={[0, -0.12, 0]}
        intensity={0.95}
        distance={5.5}
        decay={2}
        color="#fff4e4"
        castShadow={false}
      />
    </group>
  )
}

interface CeilingProps {
  building: BuildingBounds
  wallHeight: number
  lights: CeilingLightDef[]
  visible: boolean
  useDefaultRooms?: boolean
  customRooms?: CustomRoomMeasure[]
  roomKinds?: Record<string, RoomKind>
}

/** Ceiling slab + placed strip / industrial / flush-globe lights. */
export default function Ceiling({
  building,
  wallHeight,
  lights,
  visible,
  useDefaultRooms = true,
  customRooms = [],
  roomKinds = {},
}: CeilingProps) {
  // Sit just under the wall top so slabs tuck into the wall heads (no light leaks)
  const ceilingY = wallHeight - 0.015
  /** Slight overlap past wall centreline so neighbouring rooms seal with no hairline gap */
  const seamOverlap = 0.03

  const slabs = useMemo(() => {
    if (useDefaultRooms) {
      return [
        {
          id: 'default',
          x: building.centerX,
          z: building.centerZ,
          // Cover to / slightly into exterior wall bodies
          w: Math.max(0.5, building.w + seamOverlap),
          d: Math.max(0.5, building.d + seamOverlap),
        },
      ]
    }
    // Interior rooms only — terraces are open-air (no ceiling plane).
    // Use span (wall centreline loop), not inner clear, so slabs meet over partitions
    // instead of leaving wall-thickness gaps between rooms.
    return customRooms
      .filter((r) => normalizeRoomKind(roomKinds[r.id]) !== 'terrace')
      .map((r) => {
        const { minX, minZ, w, d } = r.span
        return {
          id: r.id,
          x: minX + w / 2,
          z: minZ + d / 2,
          w: Math.max(0.2, w + seamOverlap),
          d: Math.max(0.2, d + seamOverlap),
        }
      })
  }, [useDefaultRooms, building, customRooms, roomKinds])

  if (!visible) return null

  return (
    <group>
      {slabs.map((s) => (
        <mesh
          key={`ceil-${s.id}`}
          position={[s.x, ceilingY, s.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[s.w, s.d]} />
          <meshStandardMaterial
            color="#f2f0eb"
            roughness={0.92}
            metalness={0.02}
            side={THREE.DoubleSide}
            depthWrite
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      ))}
      {lights.map((light) => {
        if (light.kind === 'strip') {
          return <StripLight key={light.id} light={light} ceilingY={ceilingY} />
        }
        if (light.kind === 'globe') {
          return <FlushGlobe key={light.id} light={light} ceilingY={ceilingY} />
        }
        return <IndustrialPendant key={light.id} light={light} ceilingY={ceilingY} />
      })}
    </group>
  )
}

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { BUILDING, type BuildingBounds } from '../data/floorPlan'

const EYE_H = 1.65
const SPEED = 2.6
const SPRINT = 5.0

type KeyState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  sprint: boolean
}

/**
 * FPS walk: click canvas to lock pointer, WASD move, Shift sprint, Esc unlock.
 * Camera stays at eye height inside a soft bound around the house.
 */
export default function WalkControls({
  enabled,
  onLockChange,
  building = BUILDING,
}: {
  enabled: boolean
  onLockChange?: (locked: boolean) => void
  building?: BuildingBounds
}) {
  const { camera, gl } = useThree()
  const keys = useRef<KeyState>({
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
  })
  const locked = useRef(false)
  const forward = useRef(new THREE.Vector3())
  const right = useRef(new THREE.Vector3())
  const wish = useRef(new THREE.Vector3())

  const bound = {
    minX: -building.w / 2 - 3,
    maxX: building.w / 2 + 3,
    minZ: -building.d / 2 - 3,
    maxZ: building.d / 2 + 3,
  }

  useEffect(() => {
    if (!enabled) {
      locked.current = false
      onLockChange?.(false)
      return
    }

    // Spawn just south of the building, looking north (into the house)
    camera.position.set(0.4, EYE_H, -building.d / 2 - 1.2)
    camera.rotation.set(0, 0, 0)
    camera.rotation.order = 'YXZ'
    camera.lookAt(0.4, EYE_H, 0)
    camera.fov = 70
    camera.updateProjectionMatrix()

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = down
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.back = down
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = down
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = down
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.sprint = down
          break
        default:
          return
      }
      if (down) e.preventDefault()
    }
    const down = (e: KeyboardEvent) => onKey(e, true)
    const up = (e: KeyboardEvent) => onKey(e, false)

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      keys.current = {
        forward: false,
        back: false,
        left: false,
        right: false,
        sprint: false,
      }
    }
  }, [enabled, camera, onLockChange, building.d])

  useFrame((_, dt) => {
    if (!enabled || !locked.current) return
    const k = keys.current
    const speed = (k.sprint ? SPRINT : SPEED) * Math.min(dt, 0.05)

    camera.getWorldDirection(forward.current)
    forward.current.y = 0
    if (forward.current.lengthSq() < 1e-6) forward.current.set(0, 0, -1)
    forward.current.normalize()
    right.current.crossVectors(forward.current, new THREE.Vector3(0, 1, 0)).normalize()

    wish.current.set(0, 0, 0)
    if (k.forward) wish.current.add(forward.current)
    if (k.back) wish.current.sub(forward.current)
    if (k.right) wish.current.add(right.current)
    if (k.left) wish.current.sub(right.current)
    if (wish.current.lengthSq() > 0) {
      wish.current.normalize().multiplyScalar(speed)
      camera.position.add(wish.current)
    }

    camera.position.y = EYE_H
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bound.minX, bound.maxX)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bound.minZ, bound.maxZ)
  })

  if (!enabled) return null

  return (
    <PointerLockControls
      selector="canvas"
      onLock={() => {
        locked.current = true
        onLockChange?.(true)
      }}
      onUnlock={() => {
        locked.current = false
        onLockChange?.(false)
      }}
      // Slightly limit pitch so you don't flip upside-down
      // (PointerLockControls uses euler YXZ on camera)
      makeDefault
    />
  )
}

/** Restore dollhouse orbit camera when leaving walk mode */
export function OrbitCameraReset({ active }: { active: boolean }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!active) return
    camera.position.set(0, 16, -17)
    camera.rotation.set(0, 0, 0)
    camera.rotation.order = 'XYZ'
    camera.up.set(0, 1, 0)
    camera.lookAt(0, 0.4, 0)
    camera.fov = 40
    camera.updateProjectionMatrix()
  }, [active, camera])
  return null
}

export function getWalkSpawnHint() {
  return 'Click view to look · WASD move · Shift sprint · Esc unlock'
}

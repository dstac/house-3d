import type { Camera, Scene, WebGLRenderer } from 'three'
import type { BuildingBounds } from '../data/floorPlan'

export type SceneViewShot = {
  label: string
  dataUrl: string
}

type OrbitLike = {
  target: { set: (x: number, y: number, z: number) => void; copy: (v: { x: number; y: number; z: number }) => void; x: number; y: number; z: number }
  update: () => void
  enabled: boolean
}

type CaptureHandle = {
  gl: WebGLRenderer
  camera: Camera & {
    position: { set: (x: number, y: number, z: number) => void; clone: () => { x: number; y: number; z: number }; copy: (v: { x: number; y: number; z: number }) => void }
    lookAt: (x: number, y: number, z: number) => void
    up: { set: (x: number, y: number, z: number) => void }
    updateProjectionMatrix?: () => void
  }
  scene: Scene
  controls: OrbitLike | null
  building: BuildingBounds
}

let handle: CaptureHandle | null = null

export function registerSceneCapture(next: CaptureHandle | null) {
  handle = next
}

function waitFrames(n = 2) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(() => step(left - 1))
    }
    step(n)
  })
}

/** Capture the live 3D canvas from several orbit angles around the building. */
export async function captureSceneViews(): Promise<SceneViewShot[]> {
  if (!handle) return []
  const { gl, camera, scene, controls, building } = handle
  const extent = Math.max(building.w, building.d, 6)
  const dist = Math.max(14, extent * 1.55)
  const elev = dist * 0.72
  const targetY = 0.45

  const views: { label: string; x: number; y: number; z: number }[] = [
    { label: 'Southwest', x: -dist * 0.85, y: elev, z: -dist * 0.85 },
    { label: 'Southeast', x: dist * 0.85, y: elev, z: -dist * 0.85 },
    { label: 'Northeast', x: dist * 0.85, y: elev, z: dist * 0.85 },
    { label: 'Northwest', x: -dist * 0.85, y: elev, z: dist * 0.85 },
    { label: "Bird's eye", x: dist * 0.15, y: dist * 1.35, z: -dist * 0.35 },
  ]

  const prevPos = camera.position.clone()
  const prevTarget = controls
    ? { x: controls.target.x, y: controls.target.y, z: controls.target.z }
    : { x: 0, y: targetY, z: 0 }
  const prevEnabled = controls?.enabled ?? false
  if (controls) controls.enabled = false

  const shots: SceneViewShot[] = []
  try {
    for (const view of views) {
      camera.up.set(0, 1, 0)
      camera.position.set(view.x, view.y, view.z)
      if (controls) {
        controls.target.set(0, targetY, 0)
        controls.update()
      } else {
        camera.lookAt(0, targetY, 0)
      }
      camera.updateProjectionMatrix?.()
      gl.render(scene, camera)
      await waitFrames(2)
      gl.render(scene, camera)
      shots.push({
        label: view.label,
        dataUrl: gl.domElement.toDataURL('image/jpeg', 0.9),
      })
    }
  } finally {
    camera.position.copy(prevPos)
    if (controls) {
      controls.target.set(prevTarget.x, prevTarget.y, prevTarget.z)
      controls.update()
      controls.enabled = prevEnabled
    } else {
      camera.lookAt(prevTarget.x, prevTarget.y, prevTarget.z)
    }
    gl.render(scene, camera)
  }

  return shots
}

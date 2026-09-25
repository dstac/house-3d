import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { BuildingBounds } from '../data/floorPlan'
import { registerSceneCapture } from '../lib/sceneCapture'

/** Registers the live WebGL scene so PDF export can grab multi-angle renders. */
export default function SceneCaptureBridge({ building }: { building: BuildingBounds }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const controls = useThree((s) => s.controls)

  useEffect(() => {
    registerSceneCapture({
      gl,
      camera: camera as never,
      scene,
      controls: (controls as never) ?? null,
      building,
    })
    return () => registerSceneCapture(null)
  }, [gl, camera, scene, controls, building])

  return null
}

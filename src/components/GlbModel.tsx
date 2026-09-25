import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  MODEL_MIRROR_X_BY_TYPE,
  MODEL_URL_BY_TYPE,
  MODEL_YAW_BY_TYPE,
} from '../data/modelCatalog'
import type { FurnitureType } from '../data/floorPlan'

type MatRole = 'primary' | 'accent' | 'fixed'

function isNearWhite(c: THREE.Color, threshold = 0.92) {
  return c.r >= threshold && c.g >= threshold && c.b >= threshold
}

function classifyMaterial(mat: THREE.Material): MatRole {
  const name = (mat.name || '').toLowerCase()
  if (
    /chrome|steel|metal|handle|foot|feet|hinge|screw|led|glass|gasket|icon|logo|display|digit|glow|brushed|silver|grommet|pipe|faucet|drain/.test(
      name,
    )
  ) {
    return /oak|wood|velvet|fabric|cloth|cabinet|body|drawer|door(?!gasket)/.test(name)
      ? 'primary'
      : 'accent'
  }
  if (
    /velvet|fabric|cloth|charcoal|oak|wood|cabinet|body|drawer|door|seat|cushion|upholstery|linen|paint|panel/.test(
      name,
    )
  ) {
    return 'primary'
  }
  const std = mat as THREE.MeshStandardMaterial
  if (std.metalness != null && std.metalness > 0.55) return 'accent'
  if (std.color && !isNearWhite(std.color, 0.35) && std.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.2) {
    // very dark plastics / black gloss — treat as accent so primary tint can still recolor bodies
    if (/black|dark|matte/.test(name)) return 'accent'
  }
  return 'primary'
}

/** Fill in missing authored base colors (many exports leave baseColor white). */
function restoreAuthoredBaseColor(mat: THREE.MeshStandardMaterial) {
  const name = (mat.name || '').toLowerCase()
  if (!isNearWhite(mat.color)) return

  const physical = mat as THREE.MeshPhysicalMaterial
  if (physical.isMeshPhysicalMaterial && physical.sheen > 0 && physical.sheenColor) {
    const sheen = physical.sheenColor
    if (!isNearWhite(sheen, 0.85)) {
      mat.color.copy(sheen).multiplyScalar(0.55)
      return
    }
  }

  if (/charcoal|velvet|fabric|cloth|sofa|upholstery/.test(name)) {
    mat.color.set('#3a3e44')
  } else if (/oak|walnut|beech|wood|timber/.test(name)) {
    mat.color.set('#c4a574')
  } else if (/cream|linen|beige|ivory/.test(name)) {
    mat.color.set('#e8e0d4')
  } else if (/cabinet\s*white|interior\s*white|bodywhite|body\s*white/.test(name)) {
    mat.color.set('#f1f0ef')
  }
}

function prepareClonedScene(scene: THREE.Group) {
  const clone = scene.clone(true)
  const remove: THREE.Object3D[] = []
  clone.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return

    const name = mesh.name || ''
    if (/shadowcatcher|shadow_catcher|groundplane|ground_plane/i.test(name)) {
      remove.push(mesh)
      return
    }

    mesh.castShadow = false // dense GLBs hurt FPS when casting into the shadow map
    mesh.receiveShadow = true

    // Prefer single-sided except where the export explicitly needs both
    const geom = mesh.geometry
    const triCount = geom?.index
      ? geom.index.count / 3
      : (geom?.attributes.position?.count ?? 0) / 3
    // Skip shadow/receive on tiny hardware bits
    if (triCount < 12) {
      mesh.receiveShadow = false
    }

    const isOverlay =
      /^Tread/i.test(name) ||
      /^Shelf/i.test(name) ||
      /^Door/i.test(name) ||
      /^Drawer/i.test(name) ||
      /^Handle/i.test(name)

    const srcMats = (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).filter(Boolean) as THREE.Material[]

    const nextMats = srcMats.map((mat) => {
      const m = mat.clone()
      // Keep authored double-sided flag (velvet / thin sheets)
      if ('side' in m) {
        const srcSide = (mat as THREE.MeshStandardMaterial).side
        ;(m as THREE.MeshStandardMaterial).side =
          srcSide === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide
      }
      m.depthWrite = true
      m.depthTest = true

      if (
        (m as THREE.MeshStandardMaterial).isMeshStandardMaterial ||
        (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial
      ) {
        const std = m as THREE.MeshStandardMaterial
        restoreAuthoredBaseColor(std)
        // Ensure maps keep correct color space when present
        if (std.map) {
          std.map.colorSpace = THREE.SRGBColorSpace
          std.map.needsUpdate = true
        }
        std.userData.role = classifyMaterial(std)
        std.userData.baseColor = std.color.clone()
        if ((std as THREE.MeshPhysicalMaterial).sheenColor) {
          std.userData.baseSheen = (std as THREE.MeshPhysicalMaterial).sheenColor.clone()
        }
      } else {
        m.userData.role = 'fixed'
      }

      if (isOverlay) {
        m.polygonOffset = true
        m.polygonOffsetFactor = -2
        m.polygonOffsetUnits = -2
      }
      m.needsUpdate = true
      return m
    })

    mesh.material = nextMats.length === 1 ? nextMats[0]! : nextMats
    mesh.renderOrder = isOverlay ? 2 : 0
  })
  for (const obj of remove) {
    obj.parent?.remove(obj)
  }
  return clone
}

function applyColorTint(
  root: THREE.Object3D,
  color?: string | null,
  accentColor?: string | null,
) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    ).filter(Boolean) as THREE.Material[]

    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial
      if (!std.isMeshStandardMaterial && !(std as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
        continue
      }
      const base: THREE.Color | undefined = std.userData.baseColor
      if (!base) continue
      const role: MatRole = std.userData.role ?? 'fixed'
      if (role === 'fixed') {
        std.color.copy(base)
      } else if (role === 'primary' && color) {
        std.color.set(color)
      } else if (role === 'accent' && accentColor) {
        std.color.set(accentColor)
      } else {
        std.color.copy(base)
      }
      // Keep sheen related to fabric tint when present
      const physical = std as THREE.MeshPhysicalMaterial
      if (physical.isMeshPhysicalMaterial && physical.sheenColor && role === 'primary' && color) {
        physical.sheenColor.set(color).offsetHSL(0, 0, 0.12)
      } else if (physical.isMeshPhysicalMaterial && std.userData.baseSheen) {
        physical.sheenColor.copy(std.userData.baseSheen)
      }
      std.needsUpdate = true
    }
  })
}

/** AABB of `object` subtree expressed in `space`'s local coordinates. */
function localBoundingBox(object: THREE.Object3D, space: THREE.Object3D) {
  space.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert()
  const box = new THREE.Box3()
  const scratch = new THREE.Matrix4()
  const meshBox = new THREE.Box3()

  object.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const name = mesh.name || ''
    if (/shadowcatcher|shadow_catcher|groundplane|ground_plane/i.test(name)) return
    const geom = mesh.geometry
    if (!geom.boundingBox) geom.computeBoundingBox()
    if (!geom.boundingBox) return
    meshBox.copy(geom.boundingBox)
    scratch.multiplyMatrices(inv, mesh.matrixWorld)
    meshBox.applyMatrix4(scratch)
    const size = meshBox.getSize(new THREE.Vector3())
    if (size.x > 20 || size.z > 20) return
    box.union(meshBox)
  })

  return box
}

type NativeMetrics = {
  sizeX: number
  sizeY: number
  sizeZ: number
  centerX: number
  centerZ: number
  minY: number
}

function FittedModel({
  url,
  width,
  height,
  depth,
  modelYaw,
  modelMirrorX,
  color,
  accentColor,
}: {
  url: string
  width: number
  height: number
  depth: number
  modelYaw: number
  modelMirrorX: boolean
  color?: string | null
  accentColor?: string | null
}) {
  const { scene } = useGLTF(url)
  const root = useMemo(() => prepareClonedScene(scene), [scene])

  const outerRef = useRef<THREE.Group>(null)
  const scaleRef = useRef<THREE.Group>(null)
  const orientRef = useRef<THREE.Group>(null)
  const nativeRef = useRef<NativeMetrics | null>(null)
  const nativeKeyRef = useRef<string>('')

  useLayoutEffect(() => {
    const outer = outerRef.current
    const scaleG = scaleRef.current
    const orient = orientRef.current
    if (!outer || !scaleG || !orient) return

    const key = `${url}|${modelYaw}|${modelMirrorX ? 1 : 0}`
    if (nativeKeyRef.current !== key) {
      nativeRef.current = null
      nativeKeyRef.current = key
    }

    orient.rotation.set(0, modelYaw, 0)
    orient.scale.set(modelMirrorX ? -1 : 1, 1, 1)
    scaleG.scale.set(1, 1, 1)
    outer.position.set(0, 0, 0)

    let native = nativeRef.current
    if (!native) {
      const box = localBoundingBox(orient, outer)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      if (size.x < 1e-6 || size.y < 1e-6 || size.z < 1e-6) return

      native = {
        sizeX: size.x,
        sizeY: size.y,
        sizeZ: size.z,
        centerX: center.x,
        centerZ: center.z,
        minY: box.min.y,
      }
      nativeRef.current = native
    }

    const sx = width / native.sizeX
    const sy = height / native.sizeY
    const sz = depth / native.sizeZ
    scaleG.scale.set(sx, sy, sz)

    outer.position.set(
      -native.centerX * sx,
      -native.minY * sy,
      -native.centerZ * sz,
    )
  }, [root, url, width, height, depth, modelYaw, modelMirrorX])

  useLayoutEffect(() => {
    applyColorTint(root, color, accentColor)
  }, [root, color, accentColor])

  return (
    <group ref={outerRef}>
      <group ref={scaleRef}>
        <group ref={orientRef}>
          <primitive object={root} />
        </group>
      </group>
    </group>
  )
}

function ModelFallback({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color="#a89070" transparent opacity={0.35} wireframe />
    </mesh>
  )
}

/** Renders a catalog GLB fitted into the furniture size box. */
export default function GlbModelBody({
  type,
  w,
  h,
  d,
  color,
  accentColor,
}: {
  type: FurnitureType
  w: number
  h: number
  d: number
  color?: string | null
  accentColor?: string | null
}) {
  const url = MODEL_URL_BY_TYPE[type]
  if (!url) return null
  const modelYaw = MODEL_YAW_BY_TYPE[type] ?? 0
  const modelMirrorX = MODEL_MIRROR_X_BY_TYPE[type] ?? false

  return (
    <Suspense fallback={<ModelFallback w={w} h={h} d={d} />}>
      <FittedModel
        url={url}
        width={w}
        height={h}
        depth={d}
        modelYaw={modelYaw}
        modelMirrorX={modelMirrorX}
        color={color}
        accentColor={accentColor}
      />
    </Suspense>
  )
}

// Models load on demand when placed — avoid preloading every GLB at startup.

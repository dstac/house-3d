import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { FurnitureDef, FurnitureType } from '../data/floorPlan'
import { TV_SCREEN_H, TV_SCREEN_W } from '../data/floorPlan'
import { MODEL_URL_BY_TYPE } from '../data/modelCatalog'
import GlbModelBody from './GlbModel'
import { getBedroomRugMap, getLivingRugMap } from '../lib/rugTextures'

interface FurnitureProps {
  items: FurnitureDef[]
  color: string
  accentColor: string
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onRotate: (id: string, delta: number) => void
  onEditSize: (id: string) => void
}

function FurnitureMesh({
  item,
  color,
  accentColor,
  selected,
  onSelect,
  onMove,
  onRotate,
  onEditSize,
}: {
  item: FurnitureDef
  color: string
  accentColor: string
  selected: boolean
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onRotate: (id: string, delta: number) => void
  onEditSize: (id: string) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { gl, camera } = useThree()
  const [dragging, setDragging] = useState(false)
  const offset = useRef(new THREE.Vector3())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const hit = useRef(new THREE.Vector3())
  const local = useRef(new THREE.Vector3())
  const raycaster = useRef(new THREE.Raycaster())
  const pointer = useRef(new THREE.Vector2())

  const toLocal = (worldPoint: THREE.Vector3) => {
    local.current.copy(worldPoint)
    const parent = groupRef.current?.parent
    if (parent) parent.worldToLocal(local.current)
    return local.current
  }

  const project = (clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect()
    pointer.current.x = ((clientX - rect.left) / rect.width) * 2 - 1
    pointer.current.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.current.setFromCamera(pointer.current, camera)

    const worldY = groupRef.current
      ? new THREE.Vector3(0, item.position[1], 0).applyMatrix4(
          groupRef.current.parent!.matrixWorld,
        ).y
      : item.position[1]
    plane.current.set(new THREE.Vector3(0, 1, 0), -worldY)

    if (raycaster.current.ray.intersectPlane(plane.current, hit.current)) {
      const p = toLocal(hit.current)
      onMove(item.id, [
        p.x + offset.current.x,
        item.position[1],
        p.z + offset.current.z,
      ])
    }
  }

  useEffect(() => {
    if (!dragging) return
    const onMoveWin = (e: PointerEvent) => project(e.clientX, e.clientY)
    const onUp = () => {
      setDragging(false)
      gl.domElement.style.cursor = 'auto'
    }
    window.addEventListener('pointermove', onMoveWin)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMoveWin)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, item.id, item.position[1]])

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Left button only — select + drag
    if (e.nativeEvent.button !== 0) return
    e.stopPropagation()
    onSelect(item.id)
    setDragging(true)
    const worldY = groupRef.current
      ? new THREE.Vector3(0, item.position[1], 0).applyMatrix4(
          groupRef.current.parent!.matrixWorld,
        ).y
      : item.position[1]
    plane.current.set(new THREE.Vector3(0, 1, 0), -worldY)
    e.ray.intersectPlane(plane.current, hit.current)
    const p = toLocal(hit.current)
    offset.current.set(item.position[0] - p.x, 0, item.position[2] - p.z)
    gl.domElement.style.cursor = 'grabbing'
  }

  const onContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    e.nativeEvent.preventDefault()
    onSelect(item.id)
  }

  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    e.nativeEvent.preventDefault()
    setDragging(false)
    onSelect(item.id)
    onEditSize(item.id)
  }

  const [w, h, d] = item.size

  return (
    <group
      ref={groupRef}
      position={item.position}
      rotation={[0, item.rotation, 0]}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onPointerOver={() => {
        if (!dragging) gl.domElement.style.cursor = 'grab'
      }}
      onPointerOut={() => {
        if (!dragging) gl.domElement.style.cursor = 'auto'
      }}
    >
      {MODEL_URL_BY_TYPE[item.type] ? (
        <GlbModelBody
          type={item.type}
          w={w}
          h={h}
          d={d}
          color={item.color}
          accentColor={item.accentColor}
        />
      ) : (
        renderBody(
          item.type,
          w,
          h,
          d,
          item.color ?? color,
          item.accentColor ?? accentColor,
        )
      )}
      {selected && (
        <mesh position={[0, 0.015, 0]}>
          <boxGeometry args={[w, 0.02, d]} />
          <meshBasicMaterial
            color="#3b82f6"
            wireframe
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  )
}

function Wood({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.45} metalness={0.05} />
}
function Fabric({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.85} />
}
function Metal({ color = '#8a9096' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.35} metalness={0.65} />
}
function Ceramic({ color = '#f4f4f2' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.25} metalness={0.05} />
}

function shadeHex(hex: string, amount: number) {
  const raw = hex.replace('#', '')
  if (raw.length !== 6) return hex
  const n = parseInt(raw, 16)
  if (!Number.isFinite(n)) return hex
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount))
  const b = Math.min(255, Math.max(0, (n & 255) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function Leg({ x, z, h, color }: { x: number; z: number; h: number; color: string }) {
  return (
    <mesh position={[x, h / 2, z]} castShadow>
      <cylinderGeometry args={[0.025, 0.03, h, 8]} />
      <Wood color={color} />
    </mesh>
  )
}

const BOOKCASE_SPINE_COLORS = [
  '#6b3a2e',
  '#2f4a6e',
  '#3d5c45',
  '#8a5a2b',
  '#4a3f55',
  '#7a3030',
  '#2c5548',
  '#5c4a32',
]

/** Low-cost bookcase: few carcass meshes + one instanced book draw. */
function BookcaseBody({ w, h, d, wood }: { w: number; h: number; d: number; wood: string }) {
  const booksRef = useRef<THREE.InstancedMesh>(null)

  const side = Math.min(0.028, w * 0.04)
  const backT = 0.014
  const shelfT = 0.02
  const plinth = Math.min(0.07, h * 0.04)
  const topT = 0.026
  const innerW = Math.max(0.2, w - side * 2)
  const clearD = Math.max(0.12, d - backT - 0.016)
  const shelfCount = Math.max(3, Math.min(5, Math.round((h - plinth - topT) / 0.42)))
  const bayH = (h - plinth - topT - shelfT) / shelfCount
  const shelfZ = -d / 2 + backT + clearD / 2

  const books = useMemo(() => {
    const out: { x: number; y: number; z: number; sx: number; sy: number; sz: number; color: string }[] =
      []
    for (let i = 0; i < shelfCount; i++) {
      const shelfY = plinth + shelfT / 2 + i * bayH
      const bayBottom = shelfY + shelfT / 2
      const maxBookH = Math.max(0.12, bayH - shelfT - 0.035)
      let xCursor = -innerW / 2 + 0.014
      let bi = 0
      // Wider books → far fewer instances
      while (xCursor < innerW / 2 - 0.05 && bi < 12) {
        const seed = (i * 17 + bi * 31) % 97
        const thick = 0.038 + (seed % 4) * 0.01
        if (xCursor + thick > innerW / 2 - 0.01) break
        const bookH = maxBookH * (0.78 + (seed % 5) * 0.04)
        const bookD = clearD * 0.82
        out.push({
          x: xCursor + thick / 2,
          y: bayBottom + bookH / 2,
          z: -d / 2 + backT + bookD / 2 + 0.008,
          sx: thick,
          sy: bookH,
          sz: bookD,
          color: BOOKCASE_SPINE_COLORS[(i * 3 + bi) % BOOKCASE_SPINE_COLORS.length],
        })
        xCursor += thick + 0.006
        bi += 1
      }
    }
    return out
  }, [shelfCount, bayH, plinth, shelfT, innerW, clearD, backT, d])

  useEffect(() => {
    const mesh = booksRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    for (let i = 0; i < books.length; i++) {
      const b = books[i]!
      dummy.position.set(b.x, b.y, b.z)
      dummy.scale.set(b.sx, b.sy, b.sz)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      mesh.setColorAt(i, color.set(b.color))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [books])

  const shelfYs = useMemo(
    () => Array.from({ length: shelfCount }, (_, i) => plinth + shelfT / 2 + i * bayH),
    [shelfCount, plinth, shelfT, bayH],
  )

  return (
    <group>
      <mesh position={[0, plinth / 2, 0]} receiveShadow>
        <boxGeometry args={[w, plinth, d]} />
        <Wood color={shadeHex(wood, -12)} />
      </mesh>
      <mesh position={[-w / 2 + side / 2, plinth + (h - plinth) / 2, 0]}>
        <boxGeometry args={[side, h - plinth, d]} />
        <Wood color={wood} />
      </mesh>
      <mesh position={[w / 2 - side / 2, plinth + (h - plinth) / 2, 0]}>
        <boxGeometry args={[side, h - plinth, d]} />
        <Wood color={wood} />
      </mesh>
      <mesh position={[0, plinth + (h - plinth) / 2, -d / 2 + backT / 2]} receiveShadow>
        <boxGeometry args={[innerW, h - plinth - topT * 0.5, backT]} />
        <Wood color={shadeHex(wood, -8)} />
      </mesh>
      <mesh position={[0, h - topT / 2, 0]}>
        <boxGeometry args={[w, topT, d]} />
        <Wood color={wood} />
      </mesh>
      {shelfYs.map((y) => (
        <mesh key={y} position={[0, y, shelfZ]} receiveShadow>
          <boxGeometry args={[innerW, shelfT, clearD]} />
          <Wood color={wood} />
        </mesh>
      ))}
      {books.length > 0 && (
        <instancedMesh
          ref={booksRef}
          args={[undefined, undefined, books.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial roughness={0.84} metalness={0.02} />
        </instancedMesh>
      )}
    </group>
  )
}

function renderBody(
  type: FurnitureType,
  w: number,
  h: number,
  d: number,
  fabric: string,
  wood: string,
) {
  switch (type) {
    case 'sofa': {
      // L-sectional: main + right chaise, biscuit tufting — colors follow upholstery swatch
      const cloth = fabric
      const clothHi = shadeHex(fabric, 14)
      const clothLo = shadeHex(fabric, -18)
      const mainW = w * 0.58
      const chaiseW = w * 0.4
      const mainD = Math.min(d * 0.58, 1.05)
      const chaiseD = d * 0.96
      const mainX = -w / 2 + mainW / 2 + 0.02
      const chaiseX = w / 2 - chaiseW / 2 - 0.02
      const backZ = -d / 2 + 0.08
      const mainZ = backZ + mainD / 2
      const chaiseZ = backZ + chaiseD / 2
      const baseY = 0.14
      const seatY = 0.36
      const armH = 0.48
      const armW = 0.16

      const tufts = (
        tw: number,
        td: number,
        cx: number,
        cy: number,
        cz: number,
        cols: number,
        rows: number,
      ) => {
        const cells: ReactNode[] = []
        const gap = 0.018
        const cellW = (tw - gap * (cols - 1)) / cols
        const cellD = (td - gap * (rows - 1)) / rows
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = cx - tw / 2 + cellW / 2 + c * (cellW + gap)
            const z = cz - td / 2 + cellD / 2 + r * (cellD + gap)
            cells.push(
              <mesh key={`${c}-${r}`} position={[x, cy, z]} castShadow receiveShadow>
                <boxGeometry args={[cellW, 0.1, cellD]} />
                <meshStandardMaterial color={clothHi} roughness={0.88} />
              </mesh>,
            )
            // soft seam indent
            if (c < cols - 1) {
              cells.push(
                <mesh
                  key={`vs-${c}-${r}`}
                  position={[x + cellW / 2 + gap / 2, cy - 0.02, z]}
                >
                  <boxGeometry args={[gap * 0.7, 0.04, cellD * 0.92]} />
                  <meshStandardMaterial color={clothLo} roughness={0.95} />
                </mesh>,
              )
            }
            if (r < rows - 1) {
              cells.push(
                <mesh
                  key={`hs-${c}-${r}`}
                  position={[x, cy - 0.02, z + cellD / 2 + gap / 2]}
                >
                  <boxGeometry args={[cellW * 0.92, 0.04, gap * 0.7]} />
                  <meshStandardMaterial color={clothLo} roughness={0.95} />
                </mesh>,
              )
            }
          }
        }
        return cells
      }

      const feet: [number, number][] = [
        [mainX - mainW * 0.4, mainZ - mainD * 0.4],
        [mainX + mainW * 0.35, mainZ - mainD * 0.4],
        [mainX - mainW * 0.4, mainZ + mainD * 0.4],
        [chaiseX + chaiseW * 0.35, chaiseZ - chaiseD * 0.42],
        [chaiseX - chaiseW * 0.35, chaiseZ + chaiseD * 0.42],
        [chaiseX + chaiseW * 0.35, chaiseZ + chaiseD * 0.42],
      ]

      return (
        <group>
          {/* main seat base */}
          <mesh position={[mainX, baseY, mainZ]} castShadow receiveShadow>
            <boxGeometry args={[mainW, 0.22, mainD]} />
            <meshStandardMaterial color={cloth} roughness={0.9} />
          </mesh>
          {/* chaise base */}
          <mesh position={[chaiseX, baseY, chaiseZ]} castShadow receiveShadow>
            <boxGeometry args={[chaiseW, 0.22, chaiseD]} />
            <meshStandardMaterial color={cloth} roughness={0.9} />
          </mesh>

          {/* biscuit-tufted seats */}
          {tufts(mainW * 0.92, mainD * 0.88, mainX, seatY, mainZ + 0.02, 3, 2)}
          {tufts(chaiseW * 0.88, chaiseD * 0.9, chaiseX, seatY, chaiseZ, 2, 4)}

          {/* low back frame */}
          <mesh position={[(mainX + chaiseX) / 2, 0.52, backZ + 0.05]} castShadow>
            <boxGeometry args={[mainW + chaiseW - 0.06, 0.42, 0.12]} />
            <meshStandardMaterial color={cloth} roughness={0.9} />
          </mesh>

          {/* three plush back cushions */}
          {[-0.32, 0, 0.32].map((t, i) => {
            const span = mainW + chaiseW * 0.55
            const x = -w / 2 + armW + 0.12 + (span * (i + 0.5)) / 3
            return (
              <mesh key={`back-${i}`} position={[x, 0.7, backZ + 0.16]} castShadow>
                <boxGeometry args={[span / 3 - 0.06, 0.42, 0.18]} />
                <meshStandardMaterial color={clothHi} roughness={0.86} />
              </mesh>
            )
          })}

          {/* left block arm only */}
          <mesh position={[-w / 2 + armW / 2 + 0.02, armH / 2 + 0.06, mainZ]} castShadow>
            <boxGeometry args={[armW, armH, mainD * 0.95]} />
            <meshStandardMaterial color={cloth} roughness={0.9} />
          </mesh>

          {/* throw pillows */}
          <mesh
            position={[-w / 2 + armW + 0.22, 0.58, mainZ + mainD * 0.05]}
            rotation={[0, 0.25, 0]}
            castShadow
          >
            <boxGeometry args={[0.28, 0.28, 0.12]} />
            <meshStandardMaterial color={clothLo} roughness={0.85} />
          </mesh>
          <mesh
            position={[chaiseX - 0.05, 0.58, backZ + 0.32]}
            rotation={[0, -0.2, 0]}
            castShadow
          >
            <boxGeometry args={[0.26, 0.26, 0.11]} />
            <meshStandardMaterial color={clothLo} roughness={0.85} />
          </mesh>

          {/* chrome block feet */}
          {feet.map(([fx, fz], i) => (
            <mesh key={i} position={[fx, 0.035, fz]} castShadow>
              <boxGeometry args={[0.08, 0.07, 0.05]} />
              <Metal color="#c5c8cc" />
            </mesh>
          ))}
        </group>
      )
    }

    case 'tvStand': {
      const walnut = '#6b5344'
      const walnutHi = '#7d6352'
      const stone = '#3a3d42'
      const stoneHi = '#4a4e54'
      const consoleH = 0.48
      const topT = 0.04
      const sideT = 0.06
      const unitW = Math.max(w, TV_SCREEN_W + 0.95)
      const unitD = Math.max(d, 0.38)
      const panelH = Math.max(h, 1.9)
      const slatW = Math.min(unitW * 0.3, 0.85)
      const tvW = TV_SCREEN_W
      const tvH = TV_SCREEN_H
      const tvX = -unitW / 2 + slatW + (unitW - slatW) / 2
      const tvY = consoleH + 0.18 + tvH / 2
      const tvZ = -unitD / 2 + 0.08
      // Clear the wall-hung TV (top + gap)
      const shelfY = tvY + tvH / 2 + 0.14
      const shelfW = unitW * 0.72
      const shelfX = -unitW / 2 + slatW * 0.55 + shelfW / 2
      const drawerW = unitW * 0.55
      const drawerX = -unitW / 2 + sideT + drawerW / 2 + 0.04
      const openShelfW = unitW * 0.28
      const openShelfX = unitW / 2 - sideT - openShelfW / 2 - 0.04
      const slatCount = 14
      const slatGap = slatW / slatCount
      const slatThick = slatGap * 0.55
      const panelTop = Math.max(panelH, shelfY + 0.22)

      return (
        <group>
          {/* dark wall backing behind slats */}
          <mesh position={[-unitW / 2 + slatW / 2, consoleH + (panelTop - consoleH) / 2, -unitD / 2 + 0.02]} castShadow>
            <boxGeometry args={[slatW, panelTop - consoleH, 0.025]} />
            <meshStandardMaterial color="#1a1a1c" roughness={0.85} />
          </mesh>

          {/* vertical wood slats */}
          {Array.from({ length: slatCount }, (_, i) => {
            const x = -unitW / 2 + slatGap * (i + 0.5)
            return (
              <mesh
                key={`slat-${i}`}
                position={[x, consoleH + (panelTop - consoleH) / 2, -unitD / 2 + 0.04]}
                castShadow
              >
                <boxGeometry args={[slatThick, panelTop - consoleH - 0.02, 0.03]} />
                <Wood color={walnutHi} />
              </mesh>
            )
          })}

          {/* floating stone shelf intersecting slats */}
          <mesh position={[shelfX, shelfY, -unitD / 2 + 0.1]} castShadow>
            <boxGeometry args={[shelfW, 0.04, 0.18]} />
            <meshStandardMaterial color={stone} roughness={0.65} />
          </mesh>
          {[-0.15, -0.08, 0].map((ox, i) => (
            <mesh key={`book-${i}`} position={[shelfX - shelfW * 0.28 + ox, shelfY + 0.1, -unitD / 2 + 0.1]}>
              <boxGeometry args={[0.05, 0.16, 0.12]} />
              <meshStandardMaterial
                color={i === 1 ? '#5c4033' : i === 0 ? '#2a3340' : '#8a7a68'}
                roughness={0.8}
              />
            </mesh>
          ))}

          {/* wood console top + side legs */}
          <mesh position={[0, consoleH - topT / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[unitW, topT, unitD]} />
            <Wood color={walnut} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh
              key={`leg-${s}`}
              position={[s * (unitW / 2 - sideT / 2), consoleH / 2 - topT / 2, 0]}
              castShadow
            >
              <boxGeometry args={[sideT, consoleH - topT, unitD]} />
              <Wood color={walnut} />
            </mesh>
          ))}

          {/* dark stone drawer block */}
          <mesh position={[drawerX, (consoleH - topT) * 0.42, unitD * 0.02]} castShadow>
            <boxGeometry args={[drawerW, (consoleH - topT) * 0.78, unitD * 0.78]} />
            <meshStandardMaterial color={stone} roughness={0.7} />
          </mesh>
          <mesh position={[drawerX, (consoleH - topT) * 0.42, unitD * 0.42]}>
            <boxGeometry args={[0.008, (consoleH - topT) * 0.7, 0.01]} />
            <meshStandardMaterial color={stoneHi} />
          </mesh>

          <mesh position={[openShelfX, (consoleH - topT) * 0.35, 0]} castShadow>
            <boxGeometry args={[openShelfW, 0.03, unitD * 0.7]} />
            <meshStandardMaterial color={stone} roughness={0.7} />
          </mesh>

          <mesh position={[-unitW * 0.38, consoleH + 0.06, unitD * 0.05]} castShadow>
            <boxGeometry args={[0.28, 0.08, 0.2]} />
            <meshStandardMaterial color="#4a5560" roughness={0.8} />
          </mesh>
          <mesh position={[-unitW * 0.38, consoleH + 0.13, unitD * 0.05]} castShadow>
            <boxGeometry args={[0.24, 0.06, 0.18]} />
            <meshStandardMaterial color="#6b4f3a" roughness={0.8} />
          </mesh>

          {/* wall plate / mount */}
          <mesh position={[tvX, tvY, -unitD / 2 + 0.03]} castShadow>
            <boxGeometry args={[tvW * 0.28, 0.12, 0.03]} />
            <Metal color="#3a3a3a" />
          </mesh>
          <mesh position={[tvX, tvY, -unitD / 2 + 0.06]}>
            <boxGeometry args={[0.08, 0.06, 0.08]} />
            <Metal color="#2a2a2a" />
          </mesh>

          {/* wall-hung TV — previous 180×108 cm */}
          <mesh position={[tvX, tvY, tvZ]} castShadow>
            <boxGeometry args={[tvW, tvH, 0.05]} />
            <meshStandardMaterial color="#111" metalness={0.55} roughness={0.25} />
          </mesh>
          <mesh position={[tvX, tvY, tvZ + 0.028]}>
            <boxGeometry args={[tvW * 0.96, tvH * 0.93, 0.01]} />
            <meshStandardMaterial color="#0a1628" roughness={0.35} metalness={0.2} />
          </mesh>
        </group>
      )
    }

    case 'diningTable':
      return (
        <group>
          <mesh position={[0, h, 0]} castShadow>
            <boxGeometry args={[w, 0.05, d]} />
            <Wood color={wood} />
          </mesh>
          <mesh position={[0, h * 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, h * 0.85, 12]} />
            <Wood color={wood} />
          </mesh>
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[w * 0.28, w * 0.28, 0.04, 24]} />
            <Wood color={wood} />
          </mesh>
        </group>
      )

    case 'diningChair':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[w, 0.06, d * 0.85]} />
            <Fabric color={fabric} />
          </mesh>
          <mesh position={[0, 0.75, -d * 0.35]} castShadow>
            <boxGeometry args={[w * 0.9, 0.55, 0.05]} />
            <Wood color={wood} />
          </mesh>
          <Leg x={-w * 0.35} z={-d * 0.3} h={0.42} color={wood} />
          <Leg x={w * 0.35} z={-d * 0.3} h={0.42} color={wood} />
          <Leg x={-w * 0.35} z={d * 0.3} h={0.42} color={wood} />
          <Leg x={w * 0.35} z={d * 0.3} h={0.42} color={wood} />
        </group>
      )

    case 'sideboard':
      return (
        <group>
          <mesh position={[0, h * 0.5, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Wood color={wood} />
          </mesh>
          <mesh position={[0, h * 0.5, d * 0.51]}>
            <boxGeometry args={[0.02, h * 0.7, 0.01]} />
            <Metal />
          </mesh>
          {[-0.2, 0.2].map((ox) => (
            <mesh key={ox} position={[ox * w, h * 0.5, d * 0.52]}>
              <boxGeometry args={[0.08, 0.02, 0.02]} />
              <Metal color="#c0c0c0" />
            </mesh>
          ))}
        </group>
      )

    case 'bedDouble':
    case 'bedSingle': {
      const isDouble = type === 'bedDouble'
      const grey = fabric
      const greyDark = shadeHex(fabric, -22)
      const linen = shadeHex(fabric, 40)
      const pillow = shadeHex(fabric, 55)
      const baseH = 0.3
      const matH = 0.14
      const duvetH = 0.09
      const hbH = Math.max(1.05, h * 0.95)
      const hbT = 0.09
      const hbZ = -d / 2 + hbT / 2
      const faceZ = hbZ + hbT / 2 + 0.006
      const armLen = w * 0.4
      const chevronY = [0.22, 0.4, 0.58, 0.76].map((t) => 0.12 + t * (hbH - 0.18))

      return (
        <group>
          {/* short black block feet */}
          {(
            [
              [-w * 0.42, -d * 0.4],
              [w * 0.42, -d * 0.4],
              [-w * 0.42, d * 0.4],
              [w * 0.42, d * 0.4],
            ] as [number, number][]
          ).map(([fx, fz], i) => (
            <mesh key={i} position={[fx, 0.03, fz]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
          ))}
          {/* upholstered platform base */}
          <mesh position={[0, 0.06 + baseH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, baseH, d]} />
            <Fabric color={grey} />
          </mesh>
          {/* mattress */}
          <mesh position={[0, 0.06 + baseH + matH / 2, 0.02]} castShadow>
            <boxGeometry args={[w * 0.96, matH, d * 0.92]} />
            <Fabric color="#c8c4bc" />
          </mesh>
          {/* duvet */}
          <mesh
            position={[0, 0.06 + baseH + matH + duvetH / 2, d * 0.06]}
            castShadow
          >
            <boxGeometry args={[w * 0.98, duvetH, d * 0.78]} />
            <Fabric color={linen} />
          </mesh>
          {/* soft duvet overhang front */}
          <mesh
            position={[0, 0.06 + baseH + matH * 0.55, d * 0.48]}
            castShadow
          >
            <boxGeometry args={[w * 0.9, matH * 0.7, 0.06]} />
            <Fabric color={linen} />
          </mesh>
          {/* pillows — rear then front */}
          {(isDouble
            ? [
                [-0.24, -d * 0.28, w * 0.42],
                [0.24, -d * 0.28, w * 0.42],
                [-0.22, -d * 0.18, w * 0.36],
                [0.22, -d * 0.18, w * 0.36],
              ]
            : [
                [0, -d * 0.28, w * 0.72],
                [0, -d * 0.16, w * 0.62],
              ]
          ).map(([ox, oz, pw], i) => (
            <mesh
              key={i}
              position={[
                ox * (isDouble ? w : 1),
                0.06 + baseH + matH + duvetH + 0.08,
                oz,
              ]}
              castShadow
            >
              <boxGeometry args={[pw, 0.14, 0.22]} />
              <Fabric color={pillow} />
            </mesh>
          ))}
          {/* tall matching headboard */}
          <mesh position={[0, hbH / 2, hbZ]} castShadow>
            <boxGeometry args={[w, hbH, hbT]} />
            <Fabric color={grey} />
          </mesh>
          {/* center vertical stitch */}
          <mesh position={[0, hbH * 0.52, faceZ]}>
            <boxGeometry args={[0.012, hbH * 0.82, 0.008]} />
            <meshStandardMaterial color={greyDark} roughness={0.85} />
          </mesh>
          {/* chevron / V quilt stitching */}
          {chevronY.map((y, i) => {
            const angle = 0.55
            return (
              <group key={`v-${i}`}>
                <mesh
                  position={[-armLen * 0.32, y, faceZ]}
                  rotation={[0, 0, angle]}
                >
                  <boxGeometry args={[armLen, 0.011, 0.008]} />
                  <meshStandardMaterial color={greyDark} roughness={0.85} />
                </mesh>
                <mesh
                  position={[armLen * 0.32, y, faceZ]}
                  rotation={[0, 0, -angle]}
                >
                  <boxGeometry args={[armLen, 0.011, 0.008]} />
                  <meshStandardMaterial color={greyDark} roughness={0.85} />
                </mesh>
              </group>
            )
          })}
        </group>
      )
    }

    case 'nightstand': {
      const topH = 0.04
      const legH = h - topH
      const lightWood = '#d8c4a4'
      return (
        <group>
          <mesh position={[0, legH + topH / 2, 0]} castShadow>
            <boxGeometry args={[w, topH, d]} />
            <Wood color={lightWood} />
          </mesh>
          <mesh position={[0, legH * 0.55, 0]} castShadow>
            <boxGeometry args={[w * 0.85, 0.03, d * 0.85]} />
            <Wood color={lightWood} />
          </mesh>
          {(
            [
              [-w * 0.38, -d * 0.38],
              [w * 0.38, -d * 0.38],
              [-w * 0.38, d * 0.38],
              [w * 0.38, d * 0.38],
            ] as [number, number][]
          ).map(([lx, lz], i) => (
            <mesh key={i} position={[lx, legH / 2, lz]} castShadow>
              <cylinderGeometry args={[0.018, 0.022, legH, 8]} />
              <Wood color={lightWood} />
            </mesh>
          ))}
        </group>
      )
    }

    case 'rug':
      return (
        <mesh
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          renderOrder={2}
        >
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial
            map={getBedroomRugMap()}
            roughness={0.92}
            metalness={0}
            side={THREE.FrontSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )

    case 'areaRug':
      return (
        <mesh
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
          renderOrder={2}
        >
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial
            map={getLivingRugMap()}
            roughness={0.95}
            metalness={0}
            side={THREE.FrontSide}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      )

    case 'tableLamp':
      return (
        <group>
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[w * 0.35, w * 0.4, 0.04, 16]} />
            <meshStandardMaterial color="#f2f2f0" roughness={0.45} />
          </mesh>
          <mesh position={[0, h * 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, h * 0.55, 8]} />
            <Metal color="#ddd" />
          </mesh>
          <mesh position={[0, h * 0.72, 0]} castShadow>
            <cylinderGeometry args={[w * 0.45, w * 0.38, h * 0.35, 16]} />
            <meshStandardMaterial color="#f7f7f5" roughness={0.7} />
          </mesh>
          {/* soft glow bulb hint */}
          <mesh position={[0, h * 0.7, 0]}>
            <sphereGeometry args={[0.04, 12, 12]} />
            <meshStandardMaterial color="#fff8e7" emissive="#ffe7b0" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )

    case 'vase':
      return (
        <group>
          <mesh position={[0, h * 0.35, 0]} castShadow>
            <cylinderGeometry args={[w * 0.55, w * 0.7, h * 0.7, 12]} />
            <meshStandardMaterial color="#e8e4dc" roughness={0.4} />
          </mesh>
          <mesh position={[0, h * 0.75, 0]} castShadow>
            <cylinderGeometry args={[w * 0.35, w * 0.5, h * 0.25, 12]} />
            <meshStandardMaterial color="#e8e4dc" roughness={0.4} />
          </mesh>
          {/* simple greenery */}
          {[0, 0.7, 1.4].map((a, i) => (
            <mesh
              key={i}
              position={[Math.sin(a) * 0.02, h * 0.95, Math.cos(a) * 0.02]}
              rotation={[0.35, a, 0.15]}
              castShadow
            >
              <boxGeometry args={[0.025, 0.18, 0.01]} />
              <meshStandardMaterial color="#3d6b45" roughness={0.8} />
            </mesh>
          ))}
        </group>
      )

    case 'wardrobe':
      return (
        <group>
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w, h, d]} />
            <Wood color={wood} />
          </mesh>
          <mesh position={[0, h / 2, d * 0.51]}>
            <boxGeometry args={[0.015, h * 0.92, 0.01]} />
            <Metal />
          </mesh>
          {[-0.22, 0.22].map((ox) => (
            <mesh key={ox} position={[ox * w, h * 0.5, d * 0.52]}>
              <boxGeometry args={[0.03, 0.12, 0.02]} />
              <Metal color="#d0d0d0" />
            </mesh>
          ))}
        </group>
      )

    case 'bookcase':
      return <BookcaseBody w={w} h={h} d={d} wood={wood} />

    case 'desk':
      return (
        <group>
          <mesh position={[0, h, 0]} castShadow>
            <boxGeometry args={[w, 0.05, d]} />
            <Wood color={wood} />
          </mesh>
          <Leg x={-w * 0.42} z={-d * 0.38} h={h - 0.02} color={wood} />
          <Leg x={w * 0.42} z={-d * 0.38} h={h - 0.02} color={wood} />
          <Leg x={-w * 0.42} z={d * 0.38} h={h - 0.02} color={wood} />
          <Leg x={w * 0.42} z={d * 0.38} h={h - 0.02} color={wood} />
          {/* drawer */}
          <mesh position={[0, h * 0.7, d * 0.2]} castShadow>
            <boxGeometry args={[w * 0.5, 0.12, d * 0.4]} />
            <Wood color={wood} />
          </mesh>
          {/* monitor */}
          <mesh position={[0, h + 0.28, -d * 0.15]} castShadow>
            <boxGeometry args={[0.42, 0.28, 0.03]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh position={[0, h + 0.1, -d * 0.12]}>
            <boxGeometry args={[0.12, 0.08, 0.08]} />
            <Metal color="#333" />
          </mesh>
        </group>
      )

    case 'deskChair':
      return (
        <group>
          <mesh position={[0, 0.48, 0]} castShadow>
            <boxGeometry args={[w * 0.85, 0.06, d * 0.75]} />
            <Fabric color={fabric} />
          </mesh>
          <mesh position={[0, 0.72, -d * 0.28]} castShadow>
            <boxGeometry args={[w * 0.8, 0.4, 0.05]} />
            <Fabric color={fabric} />
          </mesh>
          <Leg x={-w * 0.3} z={-d * 0.25} h={0.45} color={wood} />
          <Leg x={w * 0.3} z={-d * 0.25} h={0.45} color={wood} />
          <Leg x={-w * 0.3} z={d * 0.25} h={0.45} color={wood} />
          <Leg x={w * 0.3} z={d * 0.25} h={0.45} color={wood} />
        </group>
      )

    case 'officeChair':
      return (
        <group>
          <mesh position={[0, 0.5, 0]} castShadow>
            <cylinderGeometry args={[w * 0.38, w * 0.4, 0.08, 20]} />
            <Fabric color={fabric} />
          </mesh>
          <mesh position={[0, 0.78, -w * 0.12]} castShadow>
            <boxGeometry args={[w * 0.7, 0.5, 0.08]} />
            <Fabric color={fabric} />
          </mesh>
          <mesh position={[0, 0.28, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.35, 8]} />
            <Metal />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return (
              <group key={i} rotation={[0, a, 0]}>
                <mesh position={[0.22, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
                  <Metal />
                </mesh>
                <mesh position={[0.35, 0.05, 0]} castShadow>
                  <sphereGeometry args={[0.04, 12, 12]} />
                  <meshStandardMaterial color="#222" roughness={0.4} />
                </mesh>
              </group>
            )
          })}
        </group>
      )

    case 'kitchen': {
      // Hob on west end; sink centered on the pair of kitchen windows
      const hobX = -w * 0.38
      const sinkX = -w * 0.07
      const hobW = 0.55
      const hobD = 0.45
      // Range hood: canopy ~65 cm above hob, chimney up the back wall
      const hoodCanopyY = h * 0.92 + 0.68
      const hoodCanopyH = 0.08
      const hoodCanopyW = hobW + 0.12
      const hoodCanopyD = hobD + 0.06
      const chimneyW = 0.28
      const chimneyD = 0.22
      const chimneyTop = hoodCanopyY + 0.85
      const chimneyH = Math.max(0.35, chimneyTop - (hoodCanopyY + hoodCanopyH / 2))
      const chimneyY = hoodCanopyY + hoodCanopyH / 2 + chimneyH / 2
      const steel = '#c5ccd3'
      const steelDark = '#9aa3ab'
      return (
        <group>
          {/* base cabinets */}
          <mesh position={[0, h * 0.42, 0]} castShadow>
            <boxGeometry args={[w, h * 0.84, d]} />
            <meshStandardMaterial color="#f2f0eb" roughness={0.55} />
          </mesh>
          {/* countertop */}
          <mesh position={[0, h * 0.88, 0]} castShadow>
            <boxGeometry args={[w + 0.04, 0.05, d + 0.04]} />
            <meshStandardMaterial color="#d8d4cc" roughness={0.3} metalness={0.1} />
          </mesh>
          {/* sink under kitchen windows */}
          <mesh position={[sinkX, h * 0.92, 0]}>
            <boxGeometry args={[0.48, 0.08, 0.36]} />
            <Metal color="#c0c8d0" />
          </mesh>
          <mesh position={[sinkX, h * 1.05, -d * 0.2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
            <Metal color="#c0c0c0" />
          </mesh>
          {/* hob / cooktop on west side */}
          <mesh position={[hobX, h * 0.92, 0]}>
            <boxGeometry args={[hobW, 0.03, hobD]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.3} />
          </mesh>
          {[
            [-0.12, -0.1],
            [0.12, -0.1],
            [-0.12, 0.1],
            [0.12, 0.1],
          ].map(([ox, oz], i) => (
            <mesh key={i} position={[hobX + ox, h * 0.945, oz]}>
              <cylinderGeometry args={[0.07, 0.07, 0.02, 16]} />
              <Metal color="#444" />
            </mesh>
          ))}
          {/* extractor hood over hob */}
          <group position={[hobX, 0, -d * 0.08]}>
            {/* canopy body */}
            <mesh position={[0, hoodCanopyY, 0]} castShadow>
              <boxGeometry args={[hoodCanopyW, hoodCanopyH, hoodCanopyD]} />
              <meshStandardMaterial color={steel} metalness={0.65} roughness={0.28} />
            </mesh>
            {/* front lip */}
            <mesh position={[0, hoodCanopyY - hoodCanopyH * 0.15, hoodCanopyD / 2 - 0.015]} castShadow>
              <boxGeometry args={[hoodCanopyW * 0.98, hoodCanopyH * 0.55, 0.03]} />
              <meshStandardMaterial color={steelDark} metalness={0.6} roughness={0.32} />
            </mesh>
            {/* underside filter / grille */}
            <mesh position={[0, hoodCanopyY - hoodCanopyH / 2 - 0.008, 0.02]}>
              <boxGeometry args={[hoodCanopyW * 0.72, 0.012, hoodCanopyD * 0.55]} />
              <meshStandardMaterial color="#5a6168" metalness={0.45} roughness={0.45} />
            </mesh>
            {/* under-hood lights */}
            {[-0.16, 0.16].map((ox) => (
              <mesh key={ox} position={[ox, hoodCanopyY - hoodCanopyH / 2 - 0.006, -hoodCanopyD * 0.22]}>
                <boxGeometry args={[0.1, 0.01, 0.04]} />
                <meshStandardMaterial
                  color="#f5f0e0"
                  emissive="#fff2cc"
                  emissiveIntensity={0.35}
                  roughness={0.4}
                />
              </mesh>
            ))}
            {/* chimney stack against wall */}
            <mesh position={[0, chimneyY, -hoodCanopyD / 2 + chimneyD / 2 + 0.01]} castShadow>
              <boxGeometry args={[chimneyW, chimneyH, chimneyD]} />
              <meshStandardMaterial color={steel} metalness={0.62} roughness={0.3} />
            </mesh>
            {/* chimney seam / telescopic look */}
            <mesh
              position={[0, chimneyY + chimneyH * 0.12, -hoodCanopyD / 2 + chimneyD / 2 + 0.02]}
            >
              <boxGeometry args={[chimneyW * 0.92, chimneyH * 0.55, chimneyD * 0.85]} />
              <meshStandardMaterial color={steelDark} metalness={0.55} roughness={0.34} />
            </mesh>
            {/* control strip on canopy front */}
            <mesh position={[0, hoodCanopyY + 0.01, hoodCanopyD / 2 + 0.001]}>
              <boxGeometry args={[0.18, 0.02, 0.008]} />
              <meshStandardMaterial color="#33383e" roughness={0.4} metalness={0.4} />
            </mesh>
          </group>
          {/* cabinet handles */}
          {[-0.35, -0.1, 0.15, 0.4].map((ox) => (
            <mesh key={ox} position={[ox * w, h * 0.5, d * 0.52]}>
              <boxGeometry args={[0.1, 0.015, 0.02]} />
              <Metal color="#c0c0c0" />
            </mesh>
          ))}
        </group>
      )
    }

    case 'kitchenCabinet':
      return (
        <group>
          <mesh position={[0, h * 0.42, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h * 0.84, d]} />
            <meshStandardMaterial color="#f2f0eb" roughness={0.55} />
          </mesh>
          <mesh position={[0, h * 0.88, 0]} castShadow>
            <boxGeometry args={[w + 0.04, 0.05, d + 0.04]} />
            <meshStandardMaterial color="#d8d4cc" roughness={0.3} metalness={0.1} />
          </mesh>
          {/* door seam */}
          <mesh position={[0, h * 0.42, d * 0.51]}>
            <boxGeometry args={[0.01, h * 0.7, 0.01]} />
            <meshStandardMaterial color="#d0cdc6" />
          </mesh>
          <mesh position={[0, h * 0.55, d * 0.52]}>
            <boxGeometry args={[0.12, 0.015, 0.02]} />
            <Metal color="#c0c0c0" />
          </mesh>
        </group>
      )

    case 'kitchenWallCabinet': {
      const body = '#f2f0eb'
      const door = '#ebe8e2'
      const doors = Math.max(1, Math.round(w / 0.4))
      const doorW = w / doors
      return (
        <group>
          {/* carcass */}
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={body} roughness={0.55} />
          </mesh>
          {/* doors */}
          {Array.from({ length: doors }, (_, i) => {
            const x = -w / 2 + doorW * (i + 0.5)
            return (
              <group key={i}>
                <mesh position={[x, h / 2, d / 2 + 0.008]} castShadow>
                  <boxGeometry args={[doorW * 0.92, h * 0.92, 0.018]} />
                  <meshStandardMaterial color={door} roughness={0.5} />
                </mesh>
                <mesh position={[x + doorW * 0.28, h * 0.55, d / 2 + 0.02]}>
                  <boxGeometry args={[0.09, 0.012, 0.016]} />
                  <Metal color="#c0c0c0" />
                </mesh>
              </group>
            )
          })}
          {/* bottom light strip */}
          <mesh position={[0, 0.01, d * 0.15]}>
            <boxGeometry args={[w * 0.85, 0.012, 0.04]} />
            <meshStandardMaterial
              color="#fff6e0"
              emissive="#ffe9b8"
              emissiveIntensity={0.25}
              roughness={0.5}
            />
          </mesh>
        </group>
      )
    }

    case 'kitchenWallCorner': {
      // L footprint in local XZ: arm along +X (south wall) and +Z (return wall)
      const arm = Math.min(w, d) * 0.55
      const thick = Math.min(w, d) * 0.48
      const body = '#f2f0eb'
      const door = '#ebe8e2'
      return (
        <group>
          {/* south arm (along X, against back / -Z) */}
          <mesh
            position={[-(w - arm) / 2, h / 2, -d / 2 + thick / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[arm, h, thick]} />
            <meshStandardMaterial color={body} roughness={0.55} />
          </mesh>
          {/* east arm (along Z, against +X) */}
          <mesh
            position={[w / 2 - thick / 2, h / 2, (d - arm) / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[thick, h, arm]} />
            <meshStandardMaterial color={body} roughness={0.55} />
          </mesh>
          {/* corner filler block */}
          <mesh
            position={[w / 2 - thick / 2, h / 2, -d / 2 + thick / 2]}
            castShadow
          >
            <boxGeometry args={[thick, h, thick]} />
            <meshStandardMaterial color={body} roughness={0.55} />
          </mesh>
          {/* door on south arm (faces +Z into room) */}
          <mesh
            position={[-(w - arm) / 2, h / 2, -d / 2 + thick + 0.01]}
            castShadow
          >
            <boxGeometry args={[arm * 0.88, h * 0.9, 0.018]} />
            <meshStandardMaterial color={door} roughness={0.5} />
          </mesh>
          <mesh
            position={[-(w - arm) / 2 + arm * 0.25, h * 0.55, -d / 2 + thick + 0.022]}
          >
            <boxGeometry args={[0.09, 0.012, 0.016]} />
            <Metal color="#c0c0c0" />
          </mesh>
          {/* door on east arm (faces -X into room) */}
          <mesh
            position={[w / 2 - thick - 0.01, h / 2, (d - arm) / 2]}
            castShadow
          >
            <boxGeometry args={[0.018, h * 0.9, arm * 0.88]} />
            <meshStandardMaterial color={door} roughness={0.5} />
          </mesh>
          <mesh
            position={[w / 2 - thick - 0.022, h * 0.55, (d - arm) / 2 - arm * 0.2]}
          >
            <boxGeometry args={[0.016, 0.012, 0.09]} />
            <Metal color="#c0c0c0" />
          </mesh>
        </group>
      )
    }

    case 'fridge': {
      const bodyH = h * 0.96
      const doorGap = 0.012
      return (
        <group>
          <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, bodyH, d]} />
            <meshStandardMaterial color="#e8eaed" roughness={0.35} metalness={0.25} />
          </mesh>
          {/* freezer / fridge doors */}
          <mesh position={[0, bodyH * 0.78, d * 0.51]} castShadow>
            <boxGeometry args={[w * 0.94, bodyH * 0.34, 0.04]} />
            <meshStandardMaterial color="#dfe3e8" roughness={0.3} metalness={0.3} />
          </mesh>
          <mesh position={[0, bodyH * 0.34, d * 0.51]} castShadow>
            <boxGeometry args={[w * 0.94, bodyH * 0.58, 0.04]} />
            <meshStandardMaterial color="#dfe3e8" roughness={0.3} metalness={0.3} />
          </mesh>
          {/* seam */}
          <mesh position={[0, bodyH * 0.6, d * 0.54]}>
            <boxGeometry args={[w * 0.9, doorGap, 0.01]} />
            <meshStandardMaterial color="#b8bec6" />
          </mesh>
          {/* handles */}
          <mesh position={[w * 0.38, bodyH * 0.78, d * 0.56]}>
            <boxGeometry args={[0.02, 0.16, 0.03]} />
            <Metal color="#9aa0a6" />
          </mesh>
          <mesh position={[w * 0.38, bodyH * 0.4, d * 0.56]}>
            <boxGeometry args={[0.02, 0.28, 0.03]} />
            <Metal color="#9aa0a6" />
          </mesh>
          {/* kick plate */}
          <mesh position={[0, 0.04, d * 0.02]}>
            <boxGeometry args={[w * 0.96, 0.08, d * 0.9]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
          </mesh>
        </group>
      )
    }

    case 'bathtub':
      return (
        <group>
          <mesh position={[0, h * 0.45, 0]} castShadow>
            <boxGeometry args={[w, h * 0.9, d]} />
            <Ceramic />
          </mesh>
          {/* inner basin recess */}
          <mesh position={[0, h * 0.55, 0]}>
            <boxGeometry args={[w * 0.85, h * 0.5, d * 0.75]} />
            <meshStandardMaterial color="#e8eef2" roughness={0.2} />
          </mesh>
          <mesh position={[w * 0.35, h * 0.95, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
            <Metal color="#c0c0c0" />
          </mesh>
        </group>
      )

    case 'toilet':
      return (
        <group>
          {/* concealed cistern / wall panel */}
          <mesh position={[0, 0.75, -d * 0.42]} castShadow>
            <boxGeometry args={[w * 1.15, 1.05, 0.12]} />
            <meshStandardMaterial color="#d8dde2" roughness={0.55} />
          </mesh>
          {/* wall-hung bowl (gap under) */}
          <mesh position={[0, 0.42, 0.02]} castShadow>
            <boxGeometry args={[w, 0.28, d * 0.62]} />
            <Ceramic />
          </mesh>
          <mesh position={[0, 0.58, 0.02]} castShadow>
            <cylinderGeometry args={[w * 0.42, w * 0.38, 0.08, 20]} />
            <Ceramic />
          </mesh>
          <mesh position={[0, 0.58, 0.05]}>
            <boxGeometry args={[w * 0.65, 0.025, d * 0.35]} />
            <Ceramic color="#eaeae8" />
          </mesh>
          {/* flush plate */}
          <mesh position={[0, 1.05, -d * 0.35]}>
            <boxGeometry args={[0.16, 0.1, 0.02]} />
            <Metal color="#c8c8c8" />
          </mesh>
        </group>
      )

    case 'bathSink': {
      const cabH = Math.min(h * 0.72, 0.78)
      return (
        <group>
          {/* vanity cabinet */}
          <mesh position={[0, cabH / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, cabH, d]} />
            <Wood color={wood} />
          </mesh>
          {/* door seam */}
          <mesh position={[0, cabH * 0.45, d / 2 + 0.008]}>
            <boxGeometry args={[0.01, cabH * 0.7, 0.01]} />
            <Metal color="#666" />
          </mesh>
          {[-0.22, 0.22].map((ox) => (
            <mesh key={ox} position={[ox * w, cabH * 0.5, d / 2 + 0.015]}>
              <boxGeometry args={[0.08, 0.012, 0.018]} />
              <Metal color="#c0c0c0" />
            </mesh>
          ))}
          {/* countertop */}
          <mesh position={[0, cabH + 0.02, 0]} castShadow>
            <boxGeometry args={[w * 1.02, 0.04, d * 1.02]} />
            <meshStandardMaterial color="#e8eaed" roughness={0.35} />
          </mesh>
          {/* black bowl */}
          <mesh position={[0, cabH + 0.08, d * 0.02]} castShadow>
            <cylinderGeometry args={[w * 0.28, w * 0.26, 0.1, 28]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.35} metalness={0.15} />
          </mesh>
          <mesh position={[0, cabH + 0.1, d * 0.02]}>
            <cylinderGeometry args={[w * 0.22, w * 0.22, 0.04, 28]} />
            <meshStandardMaterial color="#0d0d0d" roughness={0.25} />
          </mesh>
          {/* faucet */}
          <mesh position={[0, cabH + 0.22, -d * 0.22]}>
            <cylinderGeometry args={[0.014, 0.014, 0.2, 8]} />
            <Metal color="#c0c0c0" />
          </mesh>
          <mesh position={[0, cabH + 0.3, -d * 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.011, 0.011, 0.14, 8]} />
            <Metal color="#c0c0c0" />
          </mesh>
        </group>
      )
    }

    case 'mirror': {
      const frame = Math.min(0.035, Math.min(w, h) * 0.08)
      const glassW = Math.max(0.08, w - frame * 2)
      const glassH = Math.max(0.08, h - frame * 2)
      const depth = Math.max(d, 0.04)
      return (
        <group>
          {/* outer frame */}
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[w, h, depth]} />
            <meshStandardMaterial
              color={wood}
              metalness={0.45}
              roughness={0.35}
            />
          </mesh>
          {/* inner bevel */}
          <mesh position={[0, 0, depth * 0.15]}>
            <boxGeometry args={[glassW + frame * 0.55, glassH + frame * 0.55, depth * 0.35]} />
            <meshStandardMaterial color={shadeHex(wood, 28)} metalness={0.5} roughness={0.3} />
          </mesh>
          {/* reflective glass */}
          <mesh position={[0, 0, depth * 0.52]} renderOrder={2}>
            <planeGeometry args={[glassW, glassH]} />
            <meshStandardMaterial
              color="#dce8f0"
              metalness={1}
              roughness={0.04}
              envMapIntensity={2.2}
              side={THREE.FrontSide}
            />
          </mesh>
          {/* subtle glass tint edge */}
          <mesh position={[0, 0, depth * 0.5]}>
            <planeGeometry args={[glassW * 0.98, glassH * 0.98]} />
            <meshStandardMaterial
              color="#9eb8c8"
              transparent
              opacity={0.12}
              roughness={0.1}
              metalness={0.8}
              depthWrite={false}
            />
          </mesh>
        </group>
      )
    }

    case 'washer':
    case 'dryer': {
      const isDryer = type === 'dryer'
      const body = isDryer ? '#c5c9ce' : '#eef1f4'
      const front = isDryer ? '#b4b9bf' : '#e2e6ea'
      const doorR = Math.min(w, d) * 0.3
      return (
        <group>
          {/* cabinet */}
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={body} roughness={0.32} metalness={0.18} />
          </mesh>
          {/* front face */}
          <mesh position={[0, h / 2, d / 2 + 0.005]}>
            <boxGeometry args={[w * 0.98, h * 0.98, 0.012]} />
            <meshStandardMaterial color={front} roughness={0.38} metalness={0.12} />
          </mesh>
          {/* door bezel (flat on front) */}
          <mesh position={[0, h * 0.46, d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[doorR, doorR, 0.035, 32]} />
            <meshStandardMaterial color="#7a838c" metalness={0.55} roughness={0.28} />
          </mesh>
          {/* glass / drum window */}
          <mesh position={[0, h * 0.46, d / 2 + 0.038]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[doorR * 0.72, doorR * 0.72, 0.02, 32]} />
            <meshStandardMaterial
              color={isDryer ? '#5a6570' : '#3d4a55'}
              roughness={0.12}
              metalness={0.35}
              transparent
              opacity={0.9}
            />
          </mesh>
          {/* control strip */}
          <mesh position={[0, h * 0.88, d / 2 + 0.018]}>
            <boxGeometry args={[w * 0.88, h * 0.14, 0.028]} />
            <meshStandardMaterial color="#22262b" roughness={0.45} />
          </mesh>
          {/* dial */}
          <mesh position={[w * 0.28, h * 0.88, d / 2 + 0.04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.03, 16]} />
            <Metal color="#d8dce0" />
          </mesh>
          {isDryer ? (
            <mesh position={[0, h * 0.14, d / 2 + 0.022]}>
              <boxGeometry args={[w * 0.48, 0.055, 0.03]} />
              <Metal color="#555a60" />
            </mesh>
          ) : (
            <mesh position={[-w * 0.26, h * 0.88, d / 2 + 0.03]}>
              <boxGeometry args={[w * 0.3, 0.07, 0.035]} />
              <meshStandardMaterial color="#d5dae0" roughness={0.4} />
            </mesh>
          )}
          {/* feet */}
          {(
            [
              [-w * 0.38, -d * 0.38],
              [w * 0.38, -d * 0.38],
              [-w * 0.38, d * 0.38],
              [w * 0.38, d * 0.38],
            ] as [number, number][]
          ).map(([fx, fz], i) => (
            <mesh key={i} position={[fx, 0.025, fz]}>
              <cylinderGeometry args={[0.03, 0.035, 0.05, 8]} />
              <Metal color="#666" />
            </mesh>
          ))}
        </group>
      )
    }

    case 'stairs': {
      const steps = 12
      const stepH = h / steps
      const stepD = d / steps
      const oak = '#c9a878'
      const oakDeep = '#b89568'
      // Underside clearance under tread i (rising toward +Z)
      const underY = (z: number) => {
        const t = THREE.MathUtils.clamp((z + d / 2) / d, 0, 1)
        return t * h * 0.92
      }
      // Cupboard only where there is real headroom under the stringer
      const cabinetH = 0.82
      const zStart = -d / 2 + (cabinetH / (h * 0.92)) * d + 0.06
      const zEnd = d / 2 - 0.08
      const cupLen = Math.max(0.4, zEnd - zStart)
      const cupMidZ = (zStart + zEnd) / 2
      const cupW = w * 0.78
      const cupX = -w * 0.08
      const doorCount = 4
      const doorW = cupLen / doorCount
      const cols = 4
      const shelfLevels = [0.08, 0.34, 0.6]

      return (
        <group>
          {Array.from({ length: steps }, (_, i) => (
            <mesh
              key={i}
              position={[0, stepH * (i + 0.5), -d / 2 + stepD * (i + 0.5)]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[w, stepH, stepD * 0.98]} />
              <Wood color="#c4a574" />
            </mesh>
          ))}
          {/* closed stringer / rail on living side */}
          <mesh position={[w * 0.46, h * 0.45, 0]} castShadow>
            <boxGeometry args={[0.05, h * 0.85, d]} />
            <Wood color="#a89070" />
          </mesh>

          {/* Under-stairs cupboard — only under the high run */}
          {cupLen > 0.35 && (
            <group>
              <mesh position={[cupX, cabinetH / 2, cupMidZ]} castShadow receiveShadow>
                <boxGeometry args={[cupW, cabinetH, cupLen]} />
                <Wood color={oak} />
              </mesh>
              {Array.from({ length: doorCount }, (_, i) => {
                const z = zStart + doorW * (i + 0.5)
                return (
                  <mesh
                    key={`door-${i}`}
                    position={[cupX - cupW / 2 - 0.01, cabinetH / 2, z]}
                    castShadow
                  >
                    <boxGeometry args={[0.02, cabinetH * 0.92, doorW * 0.9]} />
                    <Wood color={oakDeep} />
                  </mesh>
                )
              })}
              {/* door seams */}
              {Array.from({ length: doorCount - 1 }, (_, i) => (
                <mesh
                  key={`seam-${i}`}
                  position={[cupX - cupW / 2 - 0.015, cabinetH / 2, zStart + doorW * (i + 1)]}
                >
                  <boxGeometry args={[0.012, cabinetH * 0.88, 0.01]} />
                  <meshStandardMaterial color="#9a7d55" roughness={0.55} />
                </mesh>
              ))}

              {/* open shelves above cabinets, clipped under slope */}
              {Array.from({ length: cols }, (_, ci) => {
                const z = zStart + (cupLen * (ci + 0.5)) / cols
                const maxH = underY(z) - 0.06
                if (maxH <= cabinetH + 0.08) return null
                const sh = maxH - cabinetH
                return (
                  <mesh key={`col-${ci}`} position={[cupX, cabinetH + sh / 2, z]} castShadow>
                    <boxGeometry args={[cupW * 0.9, sh, 0.028]} />
                    <Wood color={oak} />
                  </mesh>
                )
              })}
              {shelfLevels.map((dy, yi) =>
                Array.from({ length: cols - 1 }, (_, ci) => {
                  const z0 = zStart + (cupLen * (ci + 0.5)) / cols
                  const z1 = zStart + (cupLen * (ci + 1.5)) / cols
                  const z = (z0 + z1) / 2
                  const y = cabinetH + dy
                  if (y + 0.05 >= underY(z)) return null
                  return (
                    <mesh
                      key={`sh-${yi}-${ci}`}
                      position={[cupX, y, z]}
                      castShadow
                      receiveShadow
                    >
                      <boxGeometry args={[cupW * 0.86, 0.024, Math.abs(z1 - z0) - 0.02]} />
                      <Wood color={oak} />
                    </mesh>
                  )
                }),
              )}
            </group>
          )}
        </group>
      )
    }

    default:
      return (
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <Fabric color={fabric} />
        </mesh>
      )
  }
}

export default function Furniture({
  items,
  color,
  accentColor,
  selectedId,
  onSelect,
  onMove,
  onRotate,
  onEditSize,
}: FurnitureProps) {
  return (
    <group onPointerMissed={() => onSelect(null)}>
      {items.map((item) => (
        <FurnitureMesh
          key={item.id}
          item={item}
          color={color}
          accentColor={accentColor}
          selected={selectedId === item.id}
          onSelect={onSelect}
          onMove={onMove}
          onRotate={onRotate}
          onEditSize={onEditSize}
        />
      ))}
    </group>
  )
}

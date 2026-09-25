import { useCallback, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import House from './House'
import Furniture from './Furniture'
import WalkControls, { OrbitCameraReset } from './WalkControls'
import SiteYard, { SiteSky } from './SiteEnvironment'
import SceneCaptureBridge from './SceneCaptureBridge'
import Ceiling from './Ceiling'
import type {
  BuildingBounds,
  CeilingLightDef,
  FurnitureDef,
  OpeningLayout,
  PartitionLayout,
  RoomKind,
  WallSeg,
} from '../data/floorPlan'
import { findCustomRectangularRooms } from '../data/floorPlan'

export interface SceneSettings {
  wallHeight: number
  wallColor: string
  floorColor: string
  tileColor: string
  furnitureColor: string
  accentColor: string
  /** @deprecated prefer granular toggles; kept for older saves */
  showDimensions?: boolean
  /** Room L×W labels and dimension lines */
  showRoomDimensions: boolean
  /** Inner clear area labels */
  showInnerArea: boolean
  /** Outer footprint area labels */
  showOuterArea: boolean
  /** Length labels on each wall */
  showWallLengths: boolean
  showFloorPlan2D: boolean
  /** Show furniture footprints / icons on the 2D plan */
  showFurniture2D: boolean
  /** Show north compass on the 2D plan */
  showCompass: boolean
  /** Show room name labels in the 3D view */
  showRoomNames: boolean
  /** When true, render door leaves; when false, only wall openings */
  showDoorLeaves: boolean
  /** True north angle on the 2D plan (rad). 0 = plan +Z / up on the drawing */
  northAngle: number
  /** Compass position on the 2D plan as fractions of the viewBox (0–1) */
  compassU?: number
  compassV?: number
  /** Preview a simple two-slope (gable) roof */
  showRoof: boolean
  /** Show ceiling slab and ceiling lights in 3D */
  showCeiling: boolean
  /** Outdoor sky, yard, and site dressing */
  showEnvironment: boolean
  /** First-person walkthrough */
  walkMode: boolean
}

interface SceneProps {
  settings: SceneSettings
  furniture: FurnitureDef[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, position: [number, number, number]) => void
  onRotate: (id: string, delta: number) => void
  onEditSize: (id: string) => void
  dragging: boolean
  walls: WallSeg[]
  building: BuildingBounds
  useDefaultRooms: boolean
  openingsEnabled: Record<string, boolean>
  openingLayout: OpeningLayout
  partitionLayout: PartitionLayout
  partitionsEnabled: Record<string, boolean>
  roomNames?: Record<string, string>
  roomKinds?: Record<string, RoomKind>
  ceilingLights?: CeilingLightDef[]
  onWalkLockChange?: (locked: boolean) => void
}

export default function Scene({
  settings,
  furniture,
  selectedId,
  onSelect,
  onMove,
  onRotate,
  onEditSize,
  dragging,
  walls,
  building,
  useDefaultRooms,
  openingsEnabled,
  openingLayout,
  partitionLayout,
  partitionsEnabled,
  roomNames = {},
  roomKinds = {},
  ceilingLights = [],
  onWalkLockChange,
}: SceneProps) {
  const walk = settings.walkMode
  const interactive = !walk
  const customRooms = useMemo(
    () => (useDefaultRooms ? [] : findCustomRectangularRooms(walls)),
    [useDefaultRooms, walls],
  )

  const handleMiss = useCallback(() => {
    if (!walk) onSelect(null)
  }, [walk, onSelect])

  const extent = Math.max(building.w, building.d)
  const camDist = Math.max(12, extent * 1.4)

  return (
    <Canvas
      key="house-view-v6"
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, camDist * 0.95, -camDist], fov: 40, near: 0.25, far: 250 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onPointerMissed={handleMiss}
      onCreated={({ gl }) => {
        gl.toneMappingExposure = 1.05
      }}
    >
      <color attach="background" args={[settings.showEnvironment ? '#9eb6c8' : '#c5d0d8']} />

      {settings.showEnvironment ? (
        <SiteSky />
      ) : (
        // Keep a light HDR so GLB metals / sheen still read when yard is off
        <Environment preset="apartment" environmentIntensity={0.35} />
      )}

      <ambientLight intensity={walk ? 0.45 : 0.55} />
      <directionalLight
        castShadow
        position={[10, 20, -6]}
        intensity={walk ? 1.35 : 1.65}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={40}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
      />
      <hemisphereLight args={['#d7e6f2', '#6e7a55', walk ? 0.45 : 0.6]} />

      <group position={[0, 0, -building.centerZ]}>
        <group scale={[-1, 1, 1]}>
          <group position={[-building.centerX, 0, 0]}>
            {settings.showEnvironment && (
              <SiteYard
                building={building}
                useDefaultRooms={useDefaultRooms}
                customRooms={customRooms}
              />
            )}
            <House
              wallHeight={settings.wallHeight}
              wallColor={settings.wallColor}
              floorColor={settings.floorColor}
              tileColor={settings.tileColor}
              walls={walls}
              building={building}
              useDefaultRooms={useDefaultRooms}
              openingsEnabled={openingsEnabled}
              openingLayout={openingLayout}
              partitionLayout={partitionLayout}
              partitionsEnabled={partitionsEnabled}
              showDimensions={
                !walk &&
                (settings.showRoomDimensions ||
                  settings.showInnerArea ||
                  settings.showOuterArea ||
                  settings.showWallLengths)
              }
              showRoomDimensions={!walk && settings.showRoomDimensions}
              showInnerArea={!walk && settings.showInnerArea}
              showOuterArea={!walk && settings.showOuterArea}
              showWallLengths={!walk && settings.showWallLengths}
              showRoomNames={!walk && settings.showRoomNames !== false}
              showDoorLeaves={settings.showDoorLeaves}
              showRoof={settings.showRoof}
              roomNames={roomNames}
              roomKinds={roomKinds}
            />
            <Ceiling
              building={building}
              wallHeight={settings.wallHeight}
              lights={ceilingLights}
              visible={settings.showCeiling !== false}
              useDefaultRooms={useDefaultRooms}
              customRooms={customRooms}
              roomKinds={roomKinds}
            />
            <Furniture
              items={furniture}
              color={settings.furnitureColor}
              accentColor={settings.accentColor}
              selectedId={interactive ? selectedId : null}
              onSelect={interactive ? onSelect : () => {}}
              onMove={interactive ? onMove : () => {}}
              onRotate={interactive ? onRotate : () => {}}
              onEditSize={interactive ? onEditSize : () => {}}
            />
          </group>
        </group>
      </group>

      {!walk && <OrbitCameraReset active />}
      <SceneCaptureBridge building={building} />
      {walk ? (
        <WalkControls enabled onLockChange={onWalkLockChange} building={building} />
      ) : (
        <OrbitControls
          makeDefault
          enabled={!dragging}
          target={[0, 0.4, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={6}
          maxDistance={Math.max(32, extent * 3)}
          enableDamping
        />
      )}
    </Canvas>
  )
}

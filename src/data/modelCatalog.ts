import type { FurnitureType } from './floorPlan'
import { STAIRS_SIZE } from './floorPlan'

/** External GLB/GLTF assets available for placement from the library. */
export interface ModelAssetDef {
  id: string
  type: FurnitureType
  name: string
  /** URL under public/ */
  url: string
  /** Default footprint / fit box [w, h, d] in meters */
  size: [number, number, number]
  rotation: number
  /**
   * Extra Y rotation applied to the raw GLB so its axes match furniture space
   * (local +X = width, +Y = up, +Z = depth/run).
   */
  modelYaw?: number
  /**
   * Flip local X to undo the scene's building mirror (`scale.x = -1`) for
   * asymmetric / labeled imports that should read correctly.
   */
  modelMirrorX?: boolean
}

export const MODEL_ASSETS: ModelAssetDef[] = [
  {
    id: 'model-stair-storage',
    type: 'stairStorage',
    name: 'Stair storage (GLB)',
    url: '/models/stair_storage.glb',
    size: [...STAIRS_SIZE] as [number, number, number],
    rotation: Math.PI,
    modelYaw: -Math.PI / 2,
  },
  {
    id: 'model-stair-storage-mirror',
    type: 'stairStorageMirror',
    name: 'Stair storage mirrored (GLB)',
    url: '/models/stair_storage.glb',
    size: [...STAIRS_SIZE] as [number, number, number],
    rotation: Math.PI,
    modelYaw: -Math.PI / 2,
    modelMirrorX: true,
  },
  {
    id: 'model-sofa-pufetto',
    type: 'sofaPufetto',
    name: 'Sofa Pufetto',
    url: '/models/sofa_pufetto.glb',
    size: [3.1, 0.98, 1.72],
    rotation: 0,
    modelMirrorX: true,
  },
  {
    id: 'model-cabinet-2door',
    type: 'cabinet2Door',
    name: 'Cabinet (2 door)',
    url: '/models/cabinet_2door.glb',
    size: [1.0, 2.0, 0.53],
    rotation: 0,
  },
  {
    id: 'model-washing-machine',
    type: 'washingMachineModel',
    name: 'Washing machine (GLB)',
    url: '/models/washing_machine.glb',
    size: [0.6, 0.86, 0.66],
    rotation: 0,
    modelMirrorX: true,
  },
  {
    id: 'model-heat-pump-water-heater',
    type: 'heatPumpWaterHeater',
    name: 'Heat pump water heater',
    url: '/models/heat_pump_water_heater.glb',
    size: [0.7, 1.95, 0.59],
    rotation: 0,
    modelMirrorX: true,
  },
  {
    id: 'model-wash-basin-vanity',
    type: 'washBasinVanity',
    name: 'Wash basin vanity',
    // Cache-bust after mesh fix
    url: '/models/wash_basin_vanity_1.glb?v=2',
    // Native meshes ~1.21×0.78×0.51 (ignore ShadowCatcher plane)
    size: [1.21, 0.78, 0.51],
    rotation: 0,
  },
]

export const MODEL_URL_BY_TYPE: Partial<Record<FurnitureType, string>> = Object.fromEntries(
  MODEL_ASSETS.map((m) => [m.type, m.url]),
) as Partial<Record<FurnitureType, string>>

export const MODEL_YAW_BY_TYPE: Partial<Record<FurnitureType, number>> = Object.fromEntries(
  MODEL_ASSETS.map((m) => [m.type, m.modelYaw ?? 0]),
) as Partial<Record<FurnitureType, number>>

export const MODEL_MIRROR_X_BY_TYPE: Partial<Record<FurnitureType, boolean>> = Object.fromEntries(
  MODEL_ASSETS.map((m) => [m.type, Boolean(m.modelMirrorX)]),
) as Partial<Record<FurnitureType, boolean>>

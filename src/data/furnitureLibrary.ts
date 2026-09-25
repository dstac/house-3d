import { BUILDING, INITIAL_FURNITURE, type FurnitureDef, type FurnitureType } from './floorPlan'
import { MODEL_ASSETS } from './modelCatalog'

export interface LibraryAssetTemplate {
  type: FurnitureType
  label: string
  size: [number, number, number]
  rotation: number
  /** Y offset for stacked items (dryer, lamps) */
  y?: number
  color?: string
  accentColor?: string
}

export interface LibraryAsset {
  id: string
  name: string
  source: 'builtin' | 'user'
  template: LibraryAssetTemplate
}

/** Extra built-ins not required on the default plan (place from library). */
const EXTRA_BUILTIN: LibraryAsset[] = [
  {
    id: 'builtin-bookcase',
    name: 'Bookcase',
    source: 'builtin',
    template: {
      type: 'bookcase',
      label: 'Bookcase',
      size: [1.0, 2.0, 0.36],
      rotation: 0,
    },
  },
  {
    id: 'builtin-kitchenWallCabinet',
    name: 'Wall cabinet',
    source: 'builtin',
    template: {
      type: 'kitchenWallCabinet',
      label: 'Wall cabinet',
      size: [0.7, 0.72, 0.35],
      rotation: 0,
      y: 1.42,
    },
  },
  {
    id: 'builtin-kitchenWallCorner',
    name: 'Corner wall cabinet',
    source: 'builtin',
    template: {
      type: 'kitchenWallCorner',
      label: 'Corner wall cabinet',
      size: [0.7, 0.72, 0.7],
      rotation: 0,
      y: 1.42,
    },
  },
]

/** One built-in entry per furniture type from the default plan. */
function buildBuiltinLibrary(): LibraryAsset[] {
  const seen = new Set<FurnitureType>()
  const out: LibraryAsset[] = []
  for (const item of INITIAL_FURNITURE) {
    if (seen.has(item.type)) continue
    seen.add(item.type)
    out.push({
      id: `builtin-${item.type}`,
      name: item.label,
      source: 'builtin',
      template: {
        type: item.type,
        label: item.label,
        size: [...item.size] as [number, number, number],
        rotation: item.rotation,
        y: item.position[1] || undefined,
      },
    })
  }

  // External GLB/GLTF models — always list each asset (unique types)
  for (const model of MODEL_ASSETS) {
    if (seen.has(model.type)) continue
    seen.add(model.type)
    out.push({
      id: model.id,
      name: model.name,
      source: 'builtin',
      template: {
        type: model.type,
        label: model.name,
        size: [...model.size] as [number, number, number],
        rotation: model.rotation,
      },
    })
  }

  for (const extra of EXTRA_BUILTIN) {
    if (seen.has(extra.template.type)) continue
    seen.add(extra.template.type)
    out.push(extra)
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export const BUILTIN_LIBRARY: LibraryAsset[] = buildBuiltinLibrary()

export function instantiateAsset(
  asset: LibraryAsset,
  existingIds: Set<string>,
): FurnitureDef {
  let n = 1
  let id = `${asset.template.type}-${Date.now().toString(36)}`
  while (existingIds.has(id)) {
    id = `${asset.template.type}-${Date.now().toString(36)}-${n++}`
  }
  const y = asset.template.y ?? 0
  return {
    id,
    type: asset.template.type,
    label: asset.template.label,
    position: [BUILDING.centerX, y, BUILDING.centerZ],
    rotation: asset.template.rotation,
    size: [...asset.template.size] as [number, number, number],
    ...(asset.template.color ? { color: asset.template.color } : {}),
    ...(asset.template.accentColor ? { accentColor: asset.template.accentColor } : {}),
  }
}

export function assetFromFurniture(item: FurnitureDef, name: string): LibraryAsset {
  return {
    id: `user-${Date.now().toString(36)}`,
    name: name.trim() || item.label,
    source: 'user',
    template: {
      type: item.type,
      label: item.label,
      size: [...item.size] as [number, number, number],
      rotation: item.rotation,
      y: item.position[1] || undefined,
      ...(item.color ? { color: item.color } : {}),
      ...(item.accentColor ? { accentColor: item.accentColor } : {}),
    },
  }
}

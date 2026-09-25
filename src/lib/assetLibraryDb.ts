import type { LibraryAsset } from '../data/furnitureLibrary'

const STORAGE_KEY = 'house-3d-asset-library-v1'

function readRaw(): LibraryAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a): a is LibraryAsset =>
        !!a &&
        typeof a === 'object' &&
        typeof (a as LibraryAsset).id === 'string' &&
        typeof (a as LibraryAsset).name === 'string' &&
        (a as LibraryAsset).source === 'user' &&
        !!(a as LibraryAsset).template?.type,
    )
  } catch {
    return []
  }
}

function writeRaw(assets: LibraryAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assets))
}

export function listUserAssets(): LibraryAsset[] {
  return readRaw()
}

export function saveUserAsset(asset: LibraryAsset): LibraryAsset[] {
  const next = [asset, ...readRaw().filter((a) => a.id !== asset.id)]
  writeRaw(next)
  return next
}

export function deleteUserAsset(id: string): LibraryAsset[] {
  const next = readRaw().filter((a) => a.id !== id)
  writeRaw(next)
  return next
}

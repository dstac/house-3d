import type { SceneSettings } from '../components/Scene'
import type {
  CeilingLightDef,
  FurnitureDef,
  OpeningLayout,
  PartitionLayout,
  RoomKind,
  WallSeg,
} from '../data/floorPlan'

const IDB_NAME = 'house-3d-sqlite'
const IDB_STORE = 'files'
const DB_FILE = 'plans.sqlite'
const OLD_SLOTS_KEY = 'house-3d-save-slots-v1'

export interface PlanPayload {
  settings: SceneSettings
  furniture: FurnitureDef[]
  openingsEnabled: Record<string, boolean>
  openingLayout: OpeningLayout
  partitionLayout?: PartitionLayout
  partitionsEnabled?: Record<string, boolean>
  /** Omit / absent → migrate to default apartment walls */
  walls?: WallSeg[]
  /** Custom room display names keyed by stable room id */
  roomNames?: Record<string, string>
  /** Custom room kinds keyed by stable room id */
  roomKinds?: Record<string, RoomKind>
  /** Ceiling lighting fixtures */
  ceilingLights?: CeilingLightDef[]
}

export interface SavedPlanMeta {
  id: number
  name: string
  savedAt: string
}

export interface SavedPlan extends SavedPlanMeta {
  payload: PlanPayload
}

type SqlJsStatic = typeof import('sql.js').default extends infer F
  ? F extends (...args: never[]) => Promise<infer R>
    ? R
    : never
  : never
type Database = InstanceType<SqlJsStatic['Database']>

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let ready: Promise<Database> | null = null

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
  })
}

async function idbGet(): Promise<Uint8Array | null> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(DB_FILE)
    req.onsuccess = () => {
      const v = req.result
      resolve(v instanceof Uint8Array ? v : null)
    }
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
  })
}

async function idbPut(bytes: Uint8Array): Promise<void> {
  const idb = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, DB_FILE)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
}

function ensureSchema(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE,
      saved_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `)
  database.run(`CREATE UNIQUE INDEX IF NOT EXISTS plans_name_unique ON plans(name);`)
}

async function persist(database: Database) {
  await idbPut(database.export())
}

async function migrateFromLocalStorage(database: Database) {
  try {
    const raw = localStorage.getItem(OLD_SLOTS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const snap = item as {
        version?: number
        name?: string
        savedAt?: string
        settings?: SceneSettings
        furniture?: FurnitureDef[]
        openingsEnabled?: Record<string, boolean>
        openingLayout?: OpeningLayout
      }
      if (snap.version !== 1 || !snap.name || !snap.settings || !snap.furniture) continue

      const payload: PlanPayload = {
        settings: snap.settings,
        furniture: snap.furniture,
        openingsEnabled: snap.openingsEnabled ?? {},
        openingLayout: snap.openingLayout ?? {},
      }
      const name = String(snap.name).trim() || 'Migrated plan'
      const savedAt = snap.savedAt ?? new Date().toISOString()

      const find = database.prepare('SELECT id FROM plans WHERE name = ? COLLATE NOCASE')
      find.bind([name])
      const exists = find.step()
      find.free()
      if (exists) continue

      database.run('INSERT INTO plans (name, saved_at, data) VALUES (?, ?, ?)', [
        name,
        savedAt,
        JSON.stringify(payload),
      ])
    }

    await persist(database)
    localStorage.removeItem(OLD_SLOTS_KEY)
  } catch {
    /* ignore migration errors */
  }
}

export async function getPlanDb(): Promise<Database> {
  if (db) return db
  if (ready) return ready

  ready = (async () => {
    const [{ default: initSqlJs }, wasmUrl] = await Promise.all([
      import('sql.js'),
      import('sql.js/dist/sql-wasm.wasm?url').then((m) => m.default as string),
    ])
    if (!SQL) {
      SQL = await initSqlJs({ locateFile: () => wasmUrl })
    }
    const bytes = await idbGet()
    const database = bytes ? new SQL.Database(bytes) : new SQL.Database()
    ensureSchema(database)
    await migrateFromLocalStorage(database)
    db = database
    return database
  })().catch((err) => {
    ready = null
    throw err
  })

  return ready
}

function rowToMeta(row: Record<string, unknown>): SavedPlanMeta {
  return {
    id: Number(row.id),
    name: String(row.name),
    savedAt: String(row.saved_at),
  }
}

export async function listPlans(): Promise<SavedPlanMeta[]> {
  const database = await getPlanDb()
  const result = database.exec(
    'SELECT id, name, saved_at FROM plans ORDER BY datetime(saved_at) DESC, id DESC',
  )
  if (!result.length) return []
  const { columns, values } = result[0]
  return values.map((vals) => {
    const row: Record<string, unknown> = {}
    columns.forEach((col, i) => {
      row[col] = vals[i]
    })
    return rowToMeta(row)
  })
}

export async function getPlan(id: number): Promise<SavedPlan | null> {
  const database = await getPlanDb()
  const stmt = database.prepare('SELECT id, name, saved_at, data FROM plans WHERE id = ?')
  stmt.bind([id])
  if (!stmt.step()) {
    stmt.free()
    return null
  }
  const row = stmt.getAsObject()
  stmt.free()
  return {
    id: Number(row.id),
    name: String(row.name),
    savedAt: String(row.saved_at),
    payload: JSON.parse(String(row.data)) as PlanPayload,
  }
}

/** Insert or replace by name (case-insensitive). Returns plan id. */
export async function savePlan(name: string, payload: PlanPayload): Promise<number> {
  const database = await getPlanDb()
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')

  const savedAt = new Date().toISOString()
  const data = JSON.stringify(payload)

  const find = database.prepare('SELECT id FROM plans WHERE name = ? COLLATE NOCASE')
  find.bind([trimmed])
  let id: number | null = null
  if (find.step()) {
    id = Number(find.getAsObject().id)
  }
  find.free()

  if (id != null) {
    database.run('UPDATE plans SET name = ?, saved_at = ?, data = ? WHERE id = ?', [
      trimmed,
      savedAt,
      data,
      id,
    ])
  } else {
    database.run('INSERT INTO plans (name, saved_at, data) VALUES (?, ?, ?)', [
      trimmed,
      savedAt,
      data,
    ])
    id = Number(
      database.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] ?? 0,
    )
  }

  await persist(database)
  return id
}

export async function deletePlan(id: number): Promise<void> {
  const database = await getPlanDb()
  database.run('DELETE FROM plans WHERE id = ?', [id])
  await persist(database)
}

export interface PlanExportFile {
  version: 1
  exportedAt: string
  plans: Array<{
    name: string
    savedAt: string
    payload: PlanPayload
  }>
}

/** Export one plan or all plans as a portable JSON document. */
export async function exportPlansToJson(ids?: number[]): Promise<PlanExportFile> {
  const all = await listPlans()
  const selected = ids?.length ? all.filter((p) => ids.includes(p.id)) : all
  const plans = []
  for (const meta of selected) {
    const full = await getPlan(meta.id)
    if (!full) continue
    plans.push({
      name: full.name,
      savedAt: full.savedAt,
      payload: full.payload,
    })
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    plans,
  }
}

/** Import plans from JSON (overwrite same names). Returns count imported. */
export async function importPlansFromJson(doc: unknown): Promise<number> {
  if (!doc || typeof doc !== 'object') throw new Error('Invalid file')
  const raw = doc as Partial<PlanExportFile>
  if (raw.version !== 1 || !Array.isArray(raw.plans)) {
    throw new Error('Unrecognized plan file')
  }
  let count = 0
  for (const entry of raw.plans) {
    if (!entry?.name || !entry.payload) continue
    await savePlan(String(entry.name), entry.payload)
    count += 1
  }
  return count
}

export function formatPlanTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SceneSettings } from './Scene'
import {
  BUILDING,
  ROOMS,
  findCustomRectangularRooms,
  listPlanOpenings,
  normalizeRoomKind,
  ROOM_KIND_LABEL,
  type OpeningLayout,
  type RoomKind,
  type WallSeg,
} from '../data/floorPlan'
import {
  BUILTIN_LIBRARY,
  type LibraryAsset,
} from '../data/furnitureLibrary'
import { getLibraryThumb } from '../lib/libraryThumbs'
import { formatPlanTime, type SavedPlanMeta } from '../lib/planDb'

interface ControlsProps {
  settings: SceneSettings
  onChange: (next: SceneSettings) => void
  selectedLabel: string | null
  selectedRotationDeg: number | null
  onResetFurniture: () => void
  onRotateSelected: (delta: number) => void
  onDeleteSelected: () => void
  onSaveSelectedToLibrary: (name: string) => void
  libraryAssets: LibraryAsset[]
  onPlaceLibraryAsset: (asset: LibraryAsset) => void
  onDeleteLibraryAsset: (id: string) => void
  openingsEnabled: Record<string, boolean>
  openingLayout: OpeningLayout
  walls: WallSeg[]
  onToggleOpening: (id: string, enabled: boolean) => void
  onSetAllOpenings: (enabled: boolean) => void
  onResetOpenings: () => void
  partitionsEnabled: Record<string, boolean>
  onTogglePartition: (id: string, enabled: boolean) => void
  showDefaultRooms: boolean
  roomNames?: Record<string, string>
  roomKinds?: Record<string, RoomKind>
  buildingOuterArea?: number
  plans: SavedPlanMeta[]
  plansReady: boolean
  plansError: string | null
  activePlanId: number | null
  onNewPlan: () => void
  onSavePlan: (name: string) => Promise<void>
  onOverwritePlan: (id: number) => Promise<void>
  onLoadPlan: (id: number) => Promise<void>
  onDeletePlan: (id: number) => Promise<void>
  onExportPlans: () => Promise<void>
  onExportPdf: () => Promise<void>
  onImportPlans: (file: File) => Promise<void>
}

export default function Controls({
  settings,
  onChange,
  selectedLabel,
  selectedRotationDeg,
  onResetFurniture,
  onRotateSelected,
  onDeleteSelected,
  onSaveSelectedToLibrary,
  libraryAssets,
  onPlaceLibraryAsset,
  onDeleteLibraryAsset,
  openingsEnabled,
  openingLayout,
  walls,
  onToggleOpening,
  onSetAllOpenings,
  onResetOpenings,
  partitionsEnabled,
  onTogglePartition,
  showDefaultRooms,
  roomNames = {},
  roomKinds = {},
  buildingOuterArea,
  plans,
  plansReady,
  plansError,
  activePlanId,
  onNewPlan,
  onSavePlan,
  onOverwritePlan,
  onLoadPlan,
  onDeletePlan,
  onExportPlans,
  onExportPdf,
  onImportPlans,
}: ControlsProps) {
  const [planName, setPlanName] = useState('')
  const [assetName, setAssetName] = useState('')
  const [libFilter, setLibFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!status) return
    const id = window.setTimeout(() => setStatus(null), 2800)
    return () => window.clearTimeout(id)
  }, [status])

  const flash = (msg: string) => setStatus(msg)

  const set = <K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) => {
    onChange({ ...settings, [key]: value })
  }

  const planOpenings = useMemo(
    () => listPlanOpenings(openingLayout, walls),
    [openingLayout, walls],
  )
  const doors = planOpenings.filter((o) => o.kind === 'door')
  const windows = planOpenings.filter((o) => o.kind === 'window')
  const glassWalls = useMemo(() => walls.filter((w) => w.glass), [walls])
  const customRooms = useMemo(
    () => (showDefaultRooms ? [] : findCustomRectangularRooms(walls)),
    [showDefaultRooms, walls],
  )
  const interiorRooms = useMemo(
    () => customRooms.filter((r) => normalizeRoomKind(roomKinds[r.id]) !== 'terrace'),
    [customRooms, roomKinds],
  )
  const terraceArea = useMemo(
    () =>
      customRooms
        .filter((r) => normalizeRoomKind(roomKinds[r.id]) === 'terrace')
        .reduce((s, r) => s + r.inner.area, 0),
    [customRooms, roomKinds],
  )
  // Inner / outer: enclosed rooms only (terrace excluded)
  const innerTotal = showDefaultRooms
    ? ROOMS.reduce((s, r) => s + r.area, 0)
    : interiorRooms.reduce((s, r) => s + r.inner.area, 0)
  const outerTotal = showDefaultRooms
    ? BUILDING.w * BUILDING.d
    : interiorRooms.reduce((s, r) => s + r.outer.area, 0)
  // Overall: every registered loop's footprint, terraces included (not the AABB,
  // which would over-count L-shaped plans)
  const overallArea = showDefaultRooms
    ? BUILDING.w * BUILDING.d
    : customRooms.reduce((s, r) => s + r.outer.area, 0)

  const allLibrary = useMemo(() => {
    const q = libFilter.trim().toLowerCase()
    const merged = [...libraryAssets, ...BUILTIN_LIBRARY]
    if (!q) return merged
    return merged.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.template.type.toLowerCase().includes(q) ||
        a.template.label.toLowerCase().includes(q),
    )
  }, [libraryAssets, libFilter])

  const handleSave = async () => {
    const name = planName.trim()
    if (!name || busy) return
    setBusy(true)
    setStatus(null)
    try {
      await onSavePlan(name)
      flash(`Saved “${name}”`)
      setPlanName('')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      await onExportPlans()
      flash('Exported JSON — open it in another browser via Import')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleExportPdf = async () => {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      await onExportPdf()
      flash('PDF downloaded (plan + 3D views + summary)')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'PDF export failed')
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file || busy) return
    setBusy(true)
    setStatus(null)
    try {
      await onImportPlans(file)
      flash(`Imported from “${file.name}”`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <aside className="panel">
      <header className="panel-header">
        <h1>House 3D</h1>
        <p>
          {walls.length === 0 && !showDefaultRooms
            ? '0 walls · draw in 2D · furnish in 3D'
            : `${innerTotal.toFixed(2)} m² inner · ${outerTotal.toFixed(2)} m² outer`}
        </p>
      </header>

      <section className="panel-section">
        <h2>Plans</h2>
        <p className="hint">New blank plan · load saved · PDF summary · JSON backup</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onNewPlan}>
            New plan
          </button>
          <button
            type="button"
            className="btn"
            disabled={!plansReady || busy || plans.length === 0}
            onClick={() => {
              const el = document.getElementById('plans-list')
              el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }}
          >
            Load
          </button>
        </div>
        <label className="field">
          <span>Plan name</span>
          <input
            type="text"
            className="text-input"
            value={planName}
            maxLength={60}
            placeholder="e.g. Family layout"
            disabled={!plansReady || busy}
            onChange={(e) => setPlanName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSave()
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={!plansReady || busy || !planName.trim()}
          onClick={() => void handleSave()}
        >
          Save plan
        </button>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={!plansReady || busy || plans.length === 0}
            onClick={() => void handleExport()}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || walls.length === 0}
            onClick={() => void handleExportPdf()}
          >
            Export PDF
          </button>
          <button
            type="button"
            className="btn"
            disabled={!plansReady || busy}
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void handleImportFile(e.target.files?.[0])}
        />
        {status && (
          <div className="plan-toast" role="status">
            {status}
          </div>
        )}
        {plansError && <p className="hint save-error">{plansError}</p>}
        {!plansReady && !plansError && <p className="hint">Loading database…</p>}

        <ul className="plan-list" id="plans-list">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className={`plan-row${activePlanId === plan.id ? ' active' : ''}`}
            >
              <div className="plan-meta">
                <strong>{plan.name}</strong>
                <small>{formatPlanTime(plan.savedAt)}</small>
              </div>
              <div className="btn-row plan-actions">
                <button
                  type="button"
                  className="btn-icon load"
                  disabled={busy}
                  title="Load"
                  aria-label={`Load ${plan.name}`}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      try {
                        await onLoadPlan(plan.id)
                        flash(`Loaded “${plan.name}”`)
                      } catch (err) {
                        flash(err instanceof Error ? err.message : 'Load failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M5 20h14v-2H5v2zm7-18L5.33 9h3.84v4h5.66V9h3.84L12 2z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon overwrite"
                  disabled={busy}
                  title="Overwrite with current layout"
                  aria-label={`Overwrite ${plan.name}`}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      try {
                        await onOverwritePlan(plan.id)
                        flash(`Overwrote “${plan.name}”`)
                      } catch (err) {
                        flash(err instanceof Error ? err.message : 'Overwrite failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="btn-icon delete"
                  disabled={busy}
                  title="Delete"
                  aria-label={`Delete ${plan.name}`}
                  onClick={() => {
                    void (async () => {
                      setBusy(true)
                      try {
                        await onDeletePlan(plan.id)
                        flash(`Deleted “${plan.name}”`)
                      } catch (err) {
                        flash(err instanceof Error ? err.message : 'Delete failed')
                      } finally {
                        setBusy(false)
                      }
                    })()
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
        {plansReady && plans.length === 0 && (
          <p className="hint">No saved plans yet</p>
        )}
      </section>

      <section className="panel-section">
        <h2>Walls</h2>
        <label className="field">
          <span>Height · {settings.wallHeight.toFixed(2)} m</span>
          <input
            type="range"
            min={0.4}
            max={3.2}
            step={0.05}
            value={settings.wallHeight}
            onChange={(e) => set('wallHeight', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span>Wall color</span>
          <input
            type="color"
            value={settings.wallColor}
            onChange={(e) => set('wallColor', e.target.value)}
          />
        </label>
      </section>

      <section className="panel-section">
        <h2>Surfaces</h2>
        <label className="field">
          <span>Wood floor</span>
          <input
            type="color"
            value={settings.floorColor}
            onChange={(e) => set('floorColor', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Bath tiles</span>
          <input
            type="color"
            value={settings.tileColor}
            onChange={(e) => set('tileColor', e.target.value)}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showRoomDimensions}
            onChange={(e) => set('showRoomDimensions', e.target.checked)}
          />
          <span>Room dimensions (clear L × W)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showRoomNames !== false}
            onChange={(e) => set('showRoomNames', e.target.checked)}
          />
          <span>Room names (3D)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showInnerArea}
            onChange={(e) => set('showInnerArea', e.target.checked)}
          />
          <span>Inner area (clear)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showOuterArea}
            onChange={(e) => set('showOuterArea', e.target.checked)}
          />
          <span>Outer area (footprint)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showWallLengths}
            onChange={(e) => set('showWallLengths', e.target.checked)}
          />
          <span>Wall lengths</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showFloorPlan2D}
            onChange={(e) => set('showFloorPlan2D', e.target.checked)}
          />
          <span>Monochrome floor plan</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showFurniture2D !== false}
            onChange={(e) => set('showFurniture2D', e.target.checked)}
          />
          <span>Furniture on 2D plan</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showCompass !== false}
            onChange={(e) => set('showCompass', e.target.checked)}
          />
          <span>Compass on 2D plan</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showRoof}
            onChange={(e) => set('showRoof', e.target.checked)}
          />
          <span>Show roof preview (2-slope)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showCeiling !== false}
            onChange={(e) => set('showCeiling', e.target.checked)}
          />
          <span>Show ceiling & lights (3D)</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showEnvironment !== false}
            onChange={(e) => set('showEnvironment', e.target.checked)}
          />
          <span>Outdoor environment</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.walkMode}
            onChange={(e) => set('walkMode', e.target.checked)}
          />
          <span>FPS walk mode</span>
        </label>
        {settings.walkMode && (
          <p className="hint">
            Click the 3D view to lock the mouse · WASD move · Shift sprint · Esc unlock
          </p>
        )}
        {settings.showFloorPlan2D && settings.showCompass !== false && (
          <p className="hint">
            True north: {Math.round((((settings.northAngle * 180) / Math.PI) % 360 + 360) % 360)}° ·
            drag compass to move · drag N arrow to rotate
          </p>
        )}
      </section>

      <section className="panel-section">
        <h2>Doors</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showDoorLeaves}
            onChange={(e) => set('showDoorLeaves', e.target.checked)}
          />
          <span>Show door leaves (off = openings only)</span>
        </label>
        <p className="hint">Uncheck to hide · add/remove on the 2D plan</p>
        <ul className="toggle-list">
          {doors.map((o) => (
            <li key={o.id}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={openingsEnabled[o.id] !== false}
                  onChange={(e) => onToggleOpening(o.id, e.target.checked)}
                />
                <span>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section">
        <h2>Glass / partitions</h2>
        <p className="hint">
          {glassWalls.length
            ? 'Drag on 2D plan to move · uncheck to hide'
            : 'Use the Glass draw tool on the 2D plan to add a bath screen'}
        </p>
        <ul className="toggle-list">
          {glassWalls.map((w) => (
            <li key={w.id}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={partitionsEnabled[w.id] !== false}
                  onChange={(e) => onTogglePartition(w.id, e.target.checked)}
                />
                <span>{w.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section">
        <h2>Windows</h2>
        <ul className="toggle-list">
          {windows.map((o) => (
            <li key={o.id}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={openingsEnabled[o.id] !== false}
                  onChange={(e) => onToggleOpening(o.id, e.target.checked)}
                />
                <span>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => onSetAllOpenings(true)}>
            Show all
          </button>
          <button type="button" className="btn" onClick={() => onSetAllOpenings(false)}>
            Hide all
          </button>
        </div>
        <button type="button" className="btn" onClick={onResetOpenings}>
          Reset doors & windows
        </button>
      </section>

      <section className="panel-section">
        <h2>Furniture</h2>
        <p className="hint">
          Global defaults · override per piece via double-click
        </p>
        <label className="field">
          <span>Upholstery</span>
          <input
            type="color"
            value={settings.furnitureColor}
            onChange={(e) => set('furnitureColor', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Wood / accent</span>
          <input
            type="color"
            value={settings.accentColor}
            onChange={(e) => set('accentColor', e.target.value)}
          />
        </label>
        <p className="hint">
          {selectedLabel
            ? `Selected: ${selectedLabel} · ${selectedRotationDeg ?? 0}°`
            : 'Click a piece to select'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={!selectedLabel}
            onClick={() => onRotateSelected(-Math.PI / 2)}
          >
            ↺ 90°
          </button>
          <button
            type="button"
            className="btn"
            disabled={!selectedLabel}
            onClick={() => onRotateSelected(Math.PI / 2)}
          >
            ↻ 90°
          </button>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            disabled={!selectedLabel}
            onClick={onDeleteSelected}
          >
            Remove selected
          </button>
        </div>
        <p className="hint">Keys: R / Q rotate · Delete removes · double-click size</p>
        <button type="button" className="btn" onClick={onResetFurniture}>
          Reset furniture layout
        </button>
      </section>

      <section className="panel-section">
        <h2>Asset library</h2>
        <p className="hint">
          Built-in models + pieces you save · Place drops at plan center · drag into position
        </p>
        <label className="field">
          <span>Save selected as</span>
          <input
            type="text"
            className="text-input"
            value={assetName}
            maxLength={60}
            placeholder={selectedLabel ?? 'Select a piece first'}
            disabled={!selectedLabel}
            onChange={(e) => setAssetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && selectedLabel) {
                e.preventDefault()
                onSaveSelectedToLibrary(assetName.trim() || selectedLabel)
                setAssetName('')
                setStatus('Saved to library')
              }
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-with-icon"
          disabled={!selectedLabel}
          onClick={() => {
            onSaveSelectedToLibrary(assetName.trim() || selectedLabel || 'Asset')
            setAssetName('')
            setStatus('Saved to library')
          }}
        >
          <span className="btn-leading-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8.5V13h10V8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M8 2.5v7M5.5 7 8 9.5 10.5 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Save to library
        </button>
        <label className="field">
          <span>Filter</span>
          <input
            type="text"
            className="text-input"
            value={libFilter}
            placeholder="sofa, fridge, rug…"
            onChange={(e) => setLibFilter(e.target.value)}
          />
        </label>
        <ul className="library-grid">
          {allLibrary.map((asset) => (
            <li key={asset.id} className="library-card">
              <div className="library-thumb" aria-hidden>
                <img src={getLibraryThumb(asset.template.type)} alt="" />
              </div>
              <div className="library-card-body">
                <strong>{asset.name}</strong>
                <small>
                  {asset.source === 'user' ? 'Saved' : 'Built-in'} · {asset.template.type}
                </small>
                <div className="library-card-actions">
                  <button
                    type="button"
                    className="btn-icon place"
                    title="Place in plan"
                    aria-label={`Place ${asset.name}`}
                    onClick={() => onPlaceLibraryAsset(asset)}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M8 2v8M4.5 6.5 8 10l3.5-3.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 13h10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {asset.source === 'user' && (
                    <button
                      type="button"
                      className="btn-icon delete"
                      title="Remove from library"
                      aria-label={`Delete ${asset.name}`}
                      onClick={() => {
                        if (window.confirm(`Remove “${asset.name}” from library?`)) {
                          onDeleteLibraryAsset(asset.id)
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                          d="M3 4.5h10M6 4.5V3h4v1.5M5.5 4.5l.5 8h4l.5-8"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {allLibrary.length === 0 && <p className="hint">No matching assets</p>}
      </section>

      {(showDefaultRooms || customRooms.length > 0) && (
        <section className="panel-section rooms">
          <h2>Rooms</h2>
          <p className="hint">
            Total inner {innerTotal.toFixed(2)} m² · outer {outerTotal.toFixed(2)} m² · overall{' '}
            {overallArea.toFixed(2)} m²
            {terraceArea > 0.01
              ? ` · terrace ${terraceArea.toFixed(2)} m² (in overall only)`
              : ''}
          </p>
          <ul>
            {showDefaultRooms
              ? ROOMS.map((r) => (
                  <li key={r.id} className="room-row">
                    <span className="swatch" style={{ background: r.color }} />
                    <span className="room-meta">
                      <span>
                        {r.name} · {r.area.toFixed(2)} m²
                      </span>
                      <small>
                        L {(r.length * 100).toFixed(0)} × W {(r.width * 100).toFixed(0)} cm
                      </small>
                    </span>
                  </li>
                ))
              : customRooms.map((r, i) => {
                  const kind = normalizeRoomKind(roomKinds[r.id])
                  return (
                  <li key={r.id} className="room-row">
                    <span
                      className="swatch"
                      style={{
                        background:
                          kind === 'bath'
                            ? '#a8d4e8'
                            : kind === 'terrace'
                              ? '#c4b49a'
                              : `hsl(${(i * 47) % 360} 28% 72%)`,
                      }}
                    />
                    <span className="room-meta">
                      <span>
                        {roomNames[r.id] || ROOM_KIND_LABEL[kind]} · {r.inner.area.toFixed(2)} m²
                        {kind === 'terrace' ? ' (overall only)' : ''}
                      </span>
                      <small>
                        {ROOM_KIND_LABEL[kind]} · L {(r.inner.d * 100).toFixed(0)} × W{' '}
                        {(r.inner.w * 100).toFixed(0)} cm clear
                      </small>
                    </span>
                  </li>
                  )
                })}
          </ul>
        </section>
      )}
    </aside>
  )
}

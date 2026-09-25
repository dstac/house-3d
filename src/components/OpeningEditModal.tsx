import { useEffect, useId, useState } from 'react'
import type { OpeningKind } from '../data/floorPlan'

interface OpeningEditModalProps {
  label: string
  kind: OpeningKind
  /** Clear width along wall (m) */
  width: number
  /** Clear opening height (m) */
  height: number
  /** Window sill height (m); ignored for doors */
  sill: number
  wallLength: number
  /** Door style: french = 2-pane glazed; gate = terrace fence gate */
  style?: 'display' | 'french' | 'gate'
  onApply: (next: {
    width: number
    height: number
    sill: number
    style?: 'french' | 'gate'
  }) => void
  onClose: () => void
}

const WIDTH_MIN_CM = 40
const WIDTH_MAX_CM = 400
const HEIGHT_MIN_CM = 40
const HEIGHT_MAX_CM = 280
const SILL_MIN_CM = 0
const SILL_MAX_CM = 220
const STEP_CM = 1

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function parseCmDraft(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (cleaned === '' || cleaned === '.') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function CmField({
  name,
  value,
  onChange,
  min,
  max,
  autoFocus,
}: {
  name: string
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  autoFocus?: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  const commit = (raw: string) => {
    const parsed = parseCmDraft(raw)
    const next = clamp(parsed ?? value, min, max)
    onChange(next)
    setDraft(String(next))
  }

  const nudge = (delta: number) => {
    const base = parseCmDraft(draft)
    const next = clamp((base ?? value) + delta, min, max)
    onChange(next)
    setDraft(String(next))
  }

  return (
    <div className="size-field">
      <label className="size-field-label" htmlFor={id}>
        {name}
      </label>
      <input
        type="range"
        className="size-range"
        min={min}
        max={max}
        step={STEP_CM}
        value={clamp(value, min, max)}
        aria-label={`${name} slider`}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(next)
          setDraft(String(next))
        }}
      />
      <div className={`size-stepper${focused ? ' is-focused' : ''}`}>
        <button
          type="button"
          className="size-step"
          aria-label={`Decrease ${name}`}
          tabIndex={-1}
          disabled={value <= min}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => nudge(-STEP_CM)}
        >
          −
        </button>
        <input
          id={id}
          className="size-cm-input"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={draft}
          aria-label={`${name} in centimetres`}
          onFocus={(e) => {
            setFocused(true)
            e.currentTarget.select()
          }}
          onBlur={() => {
            setFocused(false)
            commit(draft)
          }}
          onChange={(e) => {
            const raw = e.target.value
            if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return
            setDraft(raw)
            const parsed = parseCmDraft(raw)
            if (parsed != null) onChange(clamp(parsed, min, max))
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              nudge(e.shiftKey ? 10 : STEP_CM)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              nudge(-(e.shiftKey ? 10 : STEP_CM))
            }
          }}
        />
        <button
          type="button"
          className="size-step"
          aria-label={`Increase ${name}`}
          tabIndex={-1}
          disabled={value >= max}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => nudge(STEP_CM)}
        >
          +
        </button>
        <span className="size-unit" aria-hidden>
          cm
        </span>
      </div>
    </div>
  )
}

export default function OpeningEditModal({
  label,
  kind,
  width,
  height,
  sill,
  wallLength,
  style,
  onApply,
  onClose,
}: OpeningEditModalProps) {
  const maxWidthCm = Math.max(
    WIDTH_MIN_CM,
    Math.min(WIDTH_MAX_CM, Math.floor(wallLength * 100) - 2),
  )
  const [wCm, setWCm] = useState(() =>
    clamp(Math.round(width * 100), WIDTH_MIN_CM, maxWidthCm),
  )
  const [hCm, setHCm] = useState(() =>
    clamp(Math.round(height * 100), HEIGHT_MIN_CM, HEIGHT_MAX_CM),
  )
  const [sillCm, setSillCm] = useState(() =>
    clamp(Math.round(sill * 100), SILL_MIN_CM, SILL_MAX_CM),
  )
  const [doorStyle, setDoorStyle] = useState<'standard' | 'french' | 'gate'>(() =>
    style === 'french' ? 'french' : style === 'gate' ? 'gate' : 'standard',
  )

  useEffect(() => {
    setWCm(clamp(Math.round(width * 100), WIDTH_MIN_CM, maxWidthCm))
    setHCm(clamp(Math.round(height * 100), HEIGHT_MIN_CM, HEIGHT_MAX_CM))
    setSillCm(clamp(Math.round(sill * 100), SILL_MIN_CM, SILL_MAX_CM))
    setDoorStyle(style === 'french' ? 'french' : style === 'gate' ? 'gate' : 'standard')
  }, [width, height, sill, style, maxWidthCm])

  const apply = () =>
    onApply({
      width: clamp(wCm, WIDTH_MIN_CM, maxWidthCm) / 100,
      height: clamp(hCm, HEIGHT_MIN_CM, HEIGHT_MAX_CM) / 100,
      sill: clamp(sillCm, SILL_MIN_CM, SILL_MAX_CM) / 100,
      ...(kind === 'door'
        ? doorStyle === 'french'
          ? { style: 'french' as const }
          : doorStyle === 'gate'
            ? { style: 'gate' as const }
            : {}
        : {}),
    })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        queueMicrotask(apply)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wCm, hCm, sillCm, doorStyle, onApply, onClose, maxWidthCm])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`${kind === 'door' ? 'Door' : 'Window'} · ${label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{label}</h2>
          <p className="hint">
            {kind === 'door'
              ? 'Width · Height — edge-drag width on the 2D plan'
              : 'Width · Height · Sill — edge-drag width on the 2D plan'}
          </p>
        </header>
        <div className="modal-body">
          <CmField
            name="Width"
            value={wCm}
            onChange={setWCm}
            min={WIDTH_MIN_CM}
            max={maxWidthCm}
            autoFocus
          />
          <CmField
            name="Height"
            value={hCm}
            onChange={setHCm}
            min={HEIGHT_MIN_CM}
            max={HEIGHT_MAX_CM}
          />
          {kind === 'window' && (
            <CmField
              name="Sill"
              value={sillCm}
              onChange={setSillCm}
              min={SILL_MIN_CM}
              max={SILL_MAX_CM}
            />
          )}
          {kind === 'door' && (
            <fieldset className="room-kind-fieldset" style={{ marginTop: '0.35rem' }}>
              <legend className="size-field-label">Door type</legend>
              <div className="room-kind-options">
                {(
                  [
                    ['standard', 'Standard door'],
                    ['french', 'French glass (2-pane)'],
                    ['gate', 'Terrace gate'],
                  ] as const
                ).map(([value, title]) => (
                  <label
                    key={value}
                    className={`room-kind-option${doorStyle === value ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="door-style"
                      value={value}
                      checked={doorStyle === value}
                      onChange={() => setDoorStyle(value)}
                    />
                    <span className="room-kind-title">{title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <footer className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={apply}>
            Apply
          </button>
        </footer>
      </div>
    </div>
  )
}

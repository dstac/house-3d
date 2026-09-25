import { useEffect, useId, useState } from 'react'

export type SizeEditApply = {
  size: [number, number, number]
  elevation: number
  color: string
  accentColor: string
  planIcon: 'box' | 'symbol'
}

interface SizeEditModalProps {
  label: string
  size: [number, number, number]
  /** Floor elevation in metres (Y). */
  elevation: number
  color: string
  accentColor: string
  planIcon?: 'box' | 'symbol'
  onApply: (next: SizeEditApply) => void
  onClose: () => void
}

const SIZE_MIN_CM = 5
const SIZE_MAX_CM = 600
const ELEV_MIN_CM = 0
const ELEV_MAX_CM = 400
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

export default function SizeEditModal({
  label,
  size,
  elevation,
  color,
  accentColor,
  planIcon = 'box',
  onApply,
  onClose,
}: SizeEditModalProps) {
  const [wCm, setWCm] = useState(() => Math.round(size[0] * 100))
  const [hCm, setHCm] = useState(() => Math.round(size[1] * 100))
  const [dCm, setDCm] = useState(() => Math.round(size[2] * 100))
  const [elevCm, setElevCm] = useState(() => Math.round(elevation * 100))
  const [pieceColor, setPieceColor] = useState(color)
  const [pieceAccent, setPieceAccent] = useState(accentColor)
  const [piecePlanIcon, setPiecePlanIcon] = useState<'box' | 'symbol'>(planIcon)

  useEffect(() => {
    setWCm(Math.round(size[0] * 100))
    setHCm(Math.round(size[1] * 100))
    setDCm(Math.round(size[2] * 100))
  }, [size])

  useEffect(() => {
    setElevCm(Math.round(elevation * 100))
  }, [elevation])

  useEffect(() => {
    setPieceColor(color)
    setPieceAccent(accentColor)
  }, [color, accentColor])

  useEffect(() => {
    setPiecePlanIcon(planIcon)
  }, [planIcon])

  const apply = () =>
    onApply({
      size: [
        clamp(wCm, SIZE_MIN_CM, SIZE_MAX_CM) / 100,
        clamp(hCm, SIZE_MIN_CM, SIZE_MAX_CM) / 100,
        clamp(dCm, SIZE_MIN_CM, SIZE_MAX_CM) / 100,
      ],
      elevation: clamp(elevCm, ELEV_MIN_CM, ELEV_MAX_CM) / 100,
      color: pieceColor,
      accentColor: pieceAccent,
      planIcon: piecePlanIcon,
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
  }, [wCm, hCm, dCm, elevCm, pieceColor, pieceAccent, piecePlanIcon, onApply, onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Size · ${label}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2>{label}</h2>
          <p className="hint">Size · elevation · colors · 2D plan icon</p>
        </header>
        <div className="modal-body">
          <CmField
            name="Width"
            value={wCm}
            onChange={setWCm}
            min={SIZE_MIN_CM}
            max={SIZE_MAX_CM}
            autoFocus
          />
          <CmField
            name="Height"
            value={hCm}
            onChange={setHCm}
            min={SIZE_MIN_CM}
            max={SIZE_MAX_CM}
          />
          <CmField
            name="Depth"
            value={dCm}
            onChange={setDCm}
            min={SIZE_MIN_CM}
            max={SIZE_MAX_CM}
          />
          <CmField
            name="Elev."
            value={elevCm}
            onChange={setElevCm}
            min={ELEV_MIN_CM}
            max={ELEV_MAX_CM}
          />
          <div className="size-color-row">
            <label className="size-color-field">
              <span>Upholstery</span>
              <input
                type="color"
                value={pieceColor}
                onChange={(e) => setPieceColor(e.target.value)}
              />
            </label>
            <label className="size-color-field">
              <span>Wood / accent</span>
              <input
                type="color"
                value={pieceAccent}
                onChange={(e) => setPieceAccent(e.target.value)}
              />
            </label>
          </div>
          <label className="toggle" style={{ marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={piecePlanIcon === 'symbol'}
              onChange={(e) => setPiecePlanIcon(e.target.checked ? 'symbol' : 'box')}
            />
            <span>2D plan: object icon (off = plain box)</span>
          </label>
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

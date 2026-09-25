import { useEffect, useId, useState } from 'react'
import { ROOM_KIND_LABEL, type RoomKind } from '../data/floorPlan'

interface RoomEditModalProps {
  roomId: string
  name: string
  kind: RoomKind
  onApply: (next: { name: string; kind: RoomKind }) => void
  onClose: () => void
}

const KINDS: RoomKind[] = ['room', 'bath', 'terrace']

const KIND_HINT: Record<RoomKind, string> = {
  room: 'Wood floor · solid walls',
  bath: 'Tile floor · solid walls',
  terrace: 'Deck planks · fence instead of walls (walls shared with rooms stay solid)',
}

export default function RoomEditModal({
  name,
  kind,
  onApply,
  onClose,
}: RoomEditModalProps) {
  const titleId = useId()
  const nameId = useId()
  const [draftName, setDraftName] = useState(name)
  const [draftKind, setDraftKind] = useState<RoomKind>(kind)

  useEffect(() => {
    setDraftName(name)
    setDraftKind(kind)
  }, [name, kind])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={titleId}>Room type</h2>
        </div>
        <div className="modal-body">
          <div className="size-field">
            <label className="size-field-label" htmlFor={nameId}>
              Name
            </label>
            <input
              id={nameId}
              className="text-input"
              type="text"
              value={draftName}
              placeholder={ROOM_KIND_LABEL[draftKind]}
              autoFocus
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onApply({ name: draftName, kind: draftKind })
                }
              }}
            />
          </div>
          <fieldset className="room-kind-fieldset">
            <legend className="size-field-label">Type</legend>
            <div className="room-kind-options">
              {KINDS.map((k) => (
                <label key={k} className={`room-kind-option${draftKind === k ? ' is-active' : ''}`}>
                  <input
                    type="radio"
                    name="room-kind"
                    value={k}
                    checked={draftKind === k}
                    onChange={() => setDraftKind(k)}
                  />
                  <span className="room-kind-title">{ROOM_KIND_LABEL[k]}</span>
                  <span className="room-kind-hint">{KIND_HINT[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => onApply({ name: draftName, kind: draftKind })}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

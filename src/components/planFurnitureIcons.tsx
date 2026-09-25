import type { FurnitureType } from '../data/floorPlan'

/**
 * Simple plan-view glyphs in local furniture space (centred, X = width, Z = depth).
 * Drawn as SVG with y increasing downward (same as plan ty).
 */
export function PlanFurnitureSymbol({
  type,
  w,
  d,
  fill,
  stroke,
}: {
  type: FurnitureType
  w: number
  d: number
  fill: string
  stroke: string
}) {
  const hw = w / 2
  const hd = d / 2
  const sw = Math.max(0.02, Math.min(w, d) * 0.06)

  const common = {
    fill,
    stroke,
    strokeWidth: sw,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }

  switch (type) {
    case 'sofa':
    case 'sofaPufetto':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d * 0.55} rx={sw * 2} {...common} />
          <rect
            x={-hw}
            y={-hd + d * 0.45}
            width={w}
            height={d * 0.55}
            rx={sw}
            {...common}
            fill={stroke}
            fillOpacity={0.15}
          />
          <rect x={-hw} y={-hd} width={w * 0.12} height={d} rx={sw} {...common} />
          <rect x={hw - w * 0.12} y={-hd} width={w * 0.12} height={d} rx={sw} {...common} />
        </g>
      )

    case 'bedDouble':
    case 'bedSingle':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
          <rect
            x={-hw + sw}
            y={-hd + sw}
            width={w - sw * 2}
            height={d * 0.28}
            rx={sw}
            {...common}
            fill={stroke}
            fillOpacity={0.2}
          />
          {type === 'bedDouble' ? (
            <>
              <circle cx={-w * 0.22} cy={-hd + d * 0.16} r={Math.min(w, d) * 0.1} {...common} />
              <circle cx={w * 0.22} cy={-hd + d * 0.16} r={Math.min(w, d) * 0.1} {...common} />
            </>
          ) : (
            <circle cx={0} cy={-hd + d * 0.16} r={Math.min(w, d) * 0.12} {...common} />
          )}
        </g>
      )

    case 'diningTable':
    case 'desk':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
          <circle cx={-hw + sw * 1.5} cy={-hd + sw * 1.5} r={sw * 1.2} fill={stroke} />
          <circle cx={hw - sw * 1.5} cy={-hd + sw * 1.5} r={sw * 1.2} fill={stroke} />
          <circle cx={-hw + sw * 1.5} cy={hd - sw * 1.5} r={sw * 1.2} fill={stroke} />
          <circle cx={hw - sw * 1.5} cy={hd - sw * 1.5} r={sw * 1.2} fill={stroke} />
        </g>
      )

    case 'diningChair':
    case 'deskChair':
    case 'officeChair':
      return (
        <g>
          <rect x={-hw * 0.85} y={-hd * 0.2} width={w * 0.85} height={d * 0.7} rx={sw} {...common} />
          <rect x={-hw} y={-hd} width={w} height={d * 0.35} rx={sw} {...common} />
        </g>
      )

    case 'tvStand':
    case 'sideboard':
    case 'cabinet2Door':
    case 'wardrobe':
    case 'bookcase':
    case 'kitchenCabinet':
    case 'kitchenWallCabinet':
    case 'stairStorage':
    case 'stairStorageMirror':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw * 0.5} {...common} />
          {type === 'bookcase' ? (
            <>
              {[-0.28, 0, 0.28].map((t) => (
                <line
                  key={t}
                  x1={t * w}
                  y1={-hd + sw}
                  x2={t * w}
                  y2={hd - sw}
                  stroke={stroke}
                  strokeWidth={sw * 0.7}
                />
              ))}
            </>
          ) : (
            <>
              <line x1={0} y1={-hd + sw} x2={0} y2={hd - sw} stroke={stroke} strokeWidth={sw} />
              <line
                x1={-hw + sw}
                y1={0}
                x2={hw - sw}
                y2={0}
                stroke={stroke}
                strokeWidth={sw * 0.7}
                strokeDasharray={`${sw * 2} ${sw}`}
              />
            </>
          )}
        </g>
      )

    case 'fridge':
    case 'washer':
    case 'dryer':
    case 'washingMachineModel':
    case 'heatPumpWaterHeater':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
          <rect
            x={-hw + sw}
            y={-hd + sw}
            width={w - sw * 2}
            height={d * 0.22}
            rx={sw * 0.5}
            {...common}
            fill={stroke}
            fillOpacity={0.2}
          />
          {(type === 'washer' || type === 'dryer' || type === 'washingMachineModel') && (
            <circle cx={0} cy={d * 0.12} r={Math.min(w, d) * 0.28} {...common} fill="none" />
          )}
        </g>
      )

    case 'kitchen':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw * 0.5} {...common} />
          <rect
            x={-hw + sw}
            y={-hd + sw}
            width={w * 0.35}
            height={d - sw * 2}
            rx={sw}
            {...common}
            fill={stroke}
            fillOpacity={0.15}
          />
          <circle cx={hw * 0.35} cy={0} r={Math.min(w, d) * 0.18} {...common} fill="none" />
        </g>
      )

    case 'bathtub':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={Math.min(w, d) * 0.35} {...common} />
          <ellipse cx={0} cy={0} rx={hw * 0.7} ry={hd * 0.55} {...common} fill="none" />
        </g>
      )

    case 'toilet':
      return (
        <g>
          <rect x={-hw * 0.7} y={-hd} width={w * 0.7} height={d * 0.4} rx={sw} {...common} />
          <ellipse cx={0} cy={hd * 0.25} rx={hw * 0.85} ry={hd * 0.55} {...common} />
        </g>
      )

    case 'bathSink':
    case 'washBasinVanity':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
          <ellipse cx={0} cy={0} rx={hw * 0.55} ry={hd * 0.45} {...common} fill="none" />
          <circle cx={0} cy={-hd * 0.55} r={sw * 1.2} fill={stroke} />
        </g>
      )

    case 'mirror':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} fill="none" />
          <line
            x1={-hw * 0.4}
            y1={-hd * 0.3}
            x2={hw * 0.4}
            y2={hd * 0.3}
            stroke={stroke}
            strokeWidth={sw}
          />
        </g>
      )

    case 'nightstand':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
          <line
            x1={-hw + sw}
            y1={0}
            x2={hw - sw}
            y2={0}
            stroke={stroke}
            strokeWidth={sw}
          />
        </g>
      )

    case 'tableLamp':
    case 'vase':
      return (
        <g>
          <ellipse cx={0} cy={hd * 0.35} rx={hw * 0.7} ry={hd * 0.35} {...common} />
          <rect x={-hw * 0.2} y={-hd} width={w * 0.4} height={d * 0.7} rx={sw} {...common} />
        </g>
      )

    case 'rug':
    case 'areaRug':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} rx={sw * 2} {...common} fillOpacity={0.35} />
          <rect
            x={-hw + sw * 2}
            y={-hd + sw * 2}
            width={w - sw * 4}
            height={d - sw * 4}
            rx={sw}
            {...common}
            fill="none"
          />
        </g>
      )

    case 'stairs':
      return (
        <g>
          <rect x={-hw} y={-hd} width={w} height={d} {...common} />
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={-hw}
              y1={-hd + d * t}
              x2={hw}
              y2={-hd + d * t}
              stroke={stroke}
              strokeWidth={sw}
            />
          ))}
        </g>
      )

    case 'kitchenWallCorner':
      return (
        <g>
          <polyline
            points={`${-hw},${hd} ${-hw},${-hd} ${hw},${-hd}`}
            fill="none"
            stroke={stroke}
            strokeWidth={Math.min(w, d) * 0.35}
            strokeLinejoin="miter"
          />
        </g>
      )

    default:
      return <rect x={-hw} y={-hd} width={w} height={d} rx={sw} {...common} />
  }
}

import { jsPDF } from 'jspdf'
import {
  ROOMS,
  findCustomRectangularRooms,
  listPlanOpenings,
  normalizeRoomKind,
  ROOM_KIND_LABEL,
  wallEdgeLength,
  wallFootprintCorners,
  wallInwardNormal,
  wallsWithOpenings,
  type BuildingBounds,
  type FurnitureDef,
  type OpeningLayout,
  type PartitionLayout,
  type RoomKind,
  type WallSeg,
} from '../data/floorPlan'

export type PlanPdfSummary = {
  planName: string
  walls: WallSeg[]
  building: BuildingBounds
  useDefaultRooms: boolean
  roomNames: Record<string, string>
  roomKinds?: Record<string, RoomKind>
  openingLayout: OpeningLayout
  openingsEnabled: Record<string, boolean>
  partitionLayout: PartitionLayout
  partitionsEnabled: Record<string, boolean>
  furniture: FurnitureDef[]
  /** Live 2D SVG from the plan view when available */
  svgElement?: SVGSVGElement | null
  /** Optional 3D viewport captures from several angles */
  views3d?: { label: string; dataUrl: string }[]
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildFallbackSvg(input: PlanPdfSummary): string {
  const walls = wallsWithOpenings(
    input.walls,
    input.openingLayout,
    input.openingsEnabled,
    input.partitionLayout,
    input.partitionsEnabled,
  )
  const b = input.building
  const pad = 1.4
  const vbW = b.w + pad * 2
  const vbH = b.d + pad * 2
  const tx = (x: number) => x - b.minX + pad
  const ty = (z: number) => b.d - (z - b.minZ) + pad

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW.toFixed(3)} ${vbH.toFixed(3)}" width="1200" height="${((1200 * vbH) / vbW).toFixed(0)}">`,
  )
  parts.push(`<rect width="100%" height="100%" fill="#fff"/>`)

  for (const wall of walls) {
    if (Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]) < 0.02) continue
    const corners = wallFootprintCorners(wall, input.walls)
    if (corners.length < 3) continue
    const pts = corners.map(([x, z]) => `${tx(x).toFixed(3)},${ty(z).toFixed(3)}`).join(' ')
    const fill = wall.glass ? 'rgba(168,212,232,0.45)' : wall.exterior ? '#222' : '#444'
    parts.push(`<polygon points="${pts}" fill="${fill}" stroke="none"/>`)

    if (!wall.glass) {
      const edgeLen = wallEdgeLength(wall, input.walls)
      if (edgeLen > 0.05) {
        const midX = (wall.a[0] + wall.b[0]) / 2
        const midZ = (wall.a[1] + wall.b[1]) / 2
        const { ix, iz } = wallInwardNormal(wall, input.walls)
        const thick = wall.thickness ?? 0.2
        const toOuter = wall.centerline ? thick / 2 : 0
        const off = toOuter + (wall.exterior ? 0.42 : 0.16)
        const lx = midX - ix * off
        const lz = midZ - iz * off
        parts.push(
          `<text x="${tx(lx).toFixed(3)}" y="${ty(lz).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#1e3a8a" font-size="0.17" font-family="Segoe UI, Helvetica, sans-serif" font-weight="600">${(edgeLen * 100).toFixed(0)} cm</text>`,
        )
      }
    }
  }

  if (input.useDefaultRooms) {
    for (const room of ROOMS) {
      parts.push(
        `<text x="${tx(room.labelAt[0]).toFixed(3)}" y="${ty(room.labelAt[1]).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#111" font-size="0.28" font-family="Segoe UI, Helvetica, sans-serif" font-weight="700">${escapeXml(room.name)}</text>`,
      )
      parts.push(
        `<text x="${tx(room.labelAt[0]).toFixed(3)}" y="${(ty(room.labelAt[1]) + 0.32).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#333" font-size="0.18" font-family="Segoe UI, Helvetica, sans-serif">${(room.length * 100).toFixed(0)} × ${(room.width * 100).toFixed(0)} cm</text>`,
      )
    }
  } else {
    findCustomRectangularRooms(input.walls).forEach((room, i) => {
      const name = input.roomNames[room.id] || `Room ${i + 1}`
      const lx = room.labelAt[0]
      const lz = room.labelAt[1]
      parts.push(
        `<text x="${tx(lx).toFixed(3)}" y="${ty(lz).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#111" font-size="0.26" font-family="Segoe UI, Helvetica, sans-serif" font-weight="700">${escapeXml(name)}</text>`,
      )
      parts.push(
        `<text x="${tx(lx).toFixed(3)}" y="${(ty(lz) + 0.28).toFixed(3)}" text-anchor="middle" dominant-baseline="middle" fill="#1e3a8a" font-size="0.16" font-family="Segoe UI, Helvetica, sans-serif">${(room.inner.d * 100).toFixed(0)} × ${(room.inner.w * 100).toFixed(0)} cm</text>`,
      )
    })
  }

  for (const item of input.furniture) {
    const [w, , d] = item.size
    const [px, , pz] = item.position
    const c = Math.cos(item.rotation)
    const s = Math.sin(item.rotation)
    const corners: [number, number][] = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([lx, lz]) => [px + lx * c + lz * s, pz - lx * s + lz * c])
    const pts = corners.map(([x, z]) => `${tx(x).toFixed(3)},${ty(z).toFixed(3)}`).join(' ')
    parts.push(`<polygon points="${pts}" fill="#ddd" stroke="#333" stroke-width="0.02"/>`)
  }

  parts.push('</svg>')
  return parts.join('')
}

async function svgToPngDataUrl(svgMarkup: string, maxWidth = 1600): Promise<{
  dataUrl: string
  width: number
  height: number
}> {
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Failed to rasterize plan SVG'))
      el.src = url
    })
    const aspect = img.naturalHeight / Math.max(1, img.naturalWidth)
    const width = Math.min(maxWidth, Math.max(800, img.naturalWidth || maxWidth))
    const height = Math.max(1, Math.round(width * aspect))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return { dataUrl: canvas.toDataURL('image/png'), width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function roomRows(input: PlanPdfSummary): {
  name: string
  detail: string
  area: string
  areaM2: number
  terrace: boolean
}[] {
  if (input.useDefaultRooms) {
    return ROOMS.map((r) => ({
      name: r.name,
      detail: `${(r.length * 100).toFixed(0)} × ${(r.width * 100).toFixed(0)} cm`,
      area: `${r.area.toFixed(2)} m²`,
      areaM2: r.area,
      terrace: false,
    }))
  }
  const kinds = input.roomKinds ?? {}
  return findCustomRectangularRooms(input.walls).map((r, i) => {
    const kind = normalizeRoomKind(kinds[r.id])
    const terrace = kind === 'terrace'
    return {
      name: input.roomNames[r.id] || ROOM_KIND_LABEL[kind],
      detail: `${(r.inner.d * 100).toFixed(0)} × ${(r.inner.w * 100).toFixed(0)} cm clear${
        terrace ? ' · terrace' : ''
      }`,
      area: `${r.inner.area.toFixed(2)} m²${terrace ? ' (overall only)' : ''}`,
      areaM2: r.inner.area,
      terrace,
    }
  })
}

/** Build and download a PDF with the floor plan drawing plus a rooms / openings summary. */
export async function exportPlanPdf(input: PlanPdfSummary): Promise<void> {
  let svgMarkup: string
  if (input.svgElement) {
    const clone = input.svgElement.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    // Force opaque white background for print
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('width', '100%')
    bg.setAttribute('height', '100%')
    bg.setAttribute('fill', '#ffffff')
    clone.insertBefore(bg, clone.firstChild)
    svgMarkup = new XMLSerializer().serializeToString(clone)
  } else {
    svgMarkup = buildFallbackSvg(input)
  }

  const { dataUrl, width: imgW, height: imgH } = await svgToPngDataUrl(svgMarkup)

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentW = pageW - margin * 2

  const title = input.planName.trim() || 'Floor plan'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(title, margin, margin + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80)
  doc.text(
    `Exported ${new Date().toLocaleString()} · House 3D`,
    margin,
    margin + 10,
  )
  doc.setTextColor(0)

  const maxImgH = pageH * 0.58
  const scale = Math.min(contentW / imgW, maxImgH / imgH)
  const drawW = imgW * scale
  const drawH = imgH * scale
  const imgX = margin + (contentW - drawW) / 2
  const imgY = margin + 14
  doc.addImage(dataUrl, 'PNG', imgX, imgY, drawW, drawH)

  let y = imgY + drawH + 10
  const rooms = roomRows(input)
  const interiorRooms = rooms.filter((r) => !r.terrace)
  const terraceRooms = rooms.filter((r) => r.terrace)
  const innerTotal = interiorRooms.reduce((s, r) => s + r.areaM2, 0)
  const terraceTotal = terraceRooms.reduce((s, r) => s + r.areaM2, 0)
  const measuredRooms = input.useDefaultRooms
    ? []
    : findCustomRectangularRooms(input.walls)
  const outerTotal = input.useDefaultRooms
    ? input.building.w * input.building.d
    : measuredRooms
        .filter((r) => normalizeRoomKind(input.roomKinds?.[r.id]) !== 'terrace')
        .reduce((s, r) => s + r.outer.area, 0)
  const overallArea = input.useDefaultRooms
    ? input.building.w * input.building.d
    : measuredRooms.reduce((s, r) => s + r.outer.area, 0)

  const ensureSpace = (need: number) => {
    if (y + need > pageH - margin) {
      doc.addPage()
      y = margin + 4
    }
  }

  const views3d = input.views3d?.filter((v) => v.dataUrl) ?? []
  if (views3d.length) {
    doc.addPage()
    y = margin + 4
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text('3D views', margin, y)
    y += 8

    const gap = 4
    const cols = 2
    const cellW = (contentW - gap) / cols
    // Leave room for label under each image
    const cellH = Math.min((pageH - margin - y - 8) / 3 - 8, cellW * 0.72)

    views3d.forEach((view, i) => {
      if (i > 0 && i % 4 === 0) {
        doc.addPage()
        y = margin + 4
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.text('3D views (continued)', margin, y)
        y += 8
      }
      const col = i % cols
      const row = Math.floor((i % 4) / cols)
      const x = margin + col * (cellW + gap)
      const top = y + row * (cellH + 10)
      const fmt = view.dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG'
      doc.addImage(view.dataUrl, fmt, x, top, cellW, cellH)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(60)
      doc.text(view.label, x, top + cellH + 4)
      doc.setTextColor(0)
    })

    // After grid, continue summary on a fresh page
    doc.addPage()
    y = margin + 4
  }

  ensureSpace(24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Summary', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Outer footprint: ${outerTotal.toFixed(2)} m²`, margin, y)
  y += 5
  doc.text(`Total inner area: ${innerTotal.toFixed(2)} m²`, margin, y)
  y += 5
  doc.text(`Full overall area: ${overallArea.toFixed(2)} m²`, margin, y)
  y += 5
  if (terraceTotal > 0.01) {
    doc.text(`Terrace (overall only): ${terraceTotal.toFixed(2)} m²`, margin, y)
    y += 5
  }
  doc.text(
    `Building: ${(input.building.d * 100).toFixed(0)} × ${(input.building.w * 100).toFixed(0)} cm (D × W)`,
    margin,
    y,
  )
  y += 8

  ensureSpace(16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Rooms', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const colName = margin
  const colDetail = margin + contentW * 0.42
  const colArea = margin + contentW * 0.82
  doc.setFont('helvetica', 'bold')
  doc.text('Name', colName, y)
  doc.text('Clear size', colDetail, y)
  doc.text('Area', colArea, y)
  y += 4
  doc.setDrawColor(180)
  doc.line(margin, y, pageW - margin, y)
  y += 5
  doc.setFont('helvetica', 'normal')

  for (const row of rooms) {
    ensureSpace(7)
    doc.text(row.name, colName, y)
    doc.text(row.detail, colDetail, y)
    doc.text(row.area, colArea, y)
    y += 5.5
  }

  const openings = listPlanOpenings(input.openingLayout, input.walls).filter(
    (o) => input.openingsEnabled[o.id] !== false,
  )
  const doors = openings.filter((o) => o.kind === 'door')
  const windows = openings.filter((o) => o.kind === 'window')

  y += 4
  ensureSpace(16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Openings', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Doors: ${doors.length}`, margin, y)
  y += 5
  for (const d of doors) {
    ensureSpace(6)
    const style = d.style === 'french' ? ' (French glass)' : ''
    doc.text(`· ${d.label}${style}`, margin + 2, y)
    y += 4.5
  }
  y += 2
  doc.text(`Windows: ${windows.length}`, margin, y)
  y += 5
  for (const w of windows) {
    ensureSpace(6)
    doc.text(`· ${w.label}`, margin + 2, y)
    y += 4.5
  }

  const glass = input.walls.filter((w) => w.glass)
  if (glass.length) {
    y += 4
    ensureSpace(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Glass partitions', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    for (const g of glass) {
      if (input.partitionsEnabled[g.id] === false) continue
      ensureSpace(6)
      const len = wallEdgeLength(g, input.walls)
      doc.text(`· ${g.label} · ${(len * 100).toFixed(0)} cm`, margin + 2, y)
      y += 4.5
    }
  }

  const safeName = title.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'floor-plan'
  doc.save(`${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

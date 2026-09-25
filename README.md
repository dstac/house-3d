# House 3D · Dollhouse Viewer

Interactive floor planner and 3D dollhouse for designing single-story houses. Draw walls in 2D, furnish in 3D, walk through the result, and export plans.

Start from a blank canvas or the bundled sample apartment (~79 m²). Custom layouts detect rectangular rooms automatically and track clear / footprint / overall areas (terraces count in overall only).

## Features

### Plans
- **New / save / load** plans (local SQLite via IndexedDB)
- **Export JSON** backup and **import** into another browser
- **Export PDF** — 2D plan, 3D views, and room summary

### 2D floor plan
- Draw **walls**, **glass** partitions, **windows**, **doors**, **French** doors, and terrace **gates**
- Wall thickness in cm with ± steppers; move, slide, and measure tools
- Collapsible toolbar, zoom / pan, optional **compass** (true north)
- Room labels, kinds (room / bath / terrace), clear L × W dimensions
- Furniture symbols on the plan; ceiling light placement

### 3D scene
- Cutaway dollhouse view (orbit / zoom) or optional **roof** preview
- Toggle **ceiling & lights** (strip, industrial, globe)
- **FPS walk** mode (WASD · Shift sprint · Esc unlock)
- Outdoor environment; fence + gate for terrace rooms
- Wall height slider; wall / floor / tile / furniture colors

### Furniture & library
- Built-in models (sofas, beds, kitchen, bath, stairs, bookcase, appliances, …)
- Drag, rotate (R / Q), resize; place from the asset library
- Save custom pieces to a personal library

### Areas
- **Inner** — clear floor (terraces excluded)
- **Outer** — room footprints (terraces excluded)
- **Overall** — all registered rooms including terraces

## Run

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

```bash
npm run build    # production build
npm run preview  # serve the build
```

## Stack

React + TypeScript + Vite + Three.js (`@react-three/fiber`, `@react-three/drei`) · sql.js · jsPDF

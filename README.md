# House 3D · Dollhouse Viewer

Interactive 3D dollhouse view of a 79 m² single-story house (from the architectural floor plan).

## Features

- Angled overhead view with **no ceiling** (cutaway / dollhouse)
- **Wall height** slider (0.4–3.2 m)
- Color controls for walls, floors, terrace, upholstery, and wood accents
- **Drag furniture** to rearrange the layout
- Orbit / zoom camera
- Room legend matching the plan (tambūras, svetainė, miegamasis, etc.)

## Run

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Stack

React + TypeScript + Vite + Three.js (`@react-three/fiber`, `@react-three/drei`)

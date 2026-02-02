# MuPattern

Standalone React app for microscopy pattern creation and registration, replacing manual Photoshop workflows.

## Quick Start

```bash
cd mupattern
bun install
bun run dev
```

Open http://localhost:5173

## Features

### Create Tab - Pattern Creation

Create tiled patterns using Bravais lattice parameters:

1. **Adjust Pattern**:
   - **Square Size**: Size of individual pattern elements (5-50px)
   - **Vector 1 (a, α)**: First lattice vector in polar coordinates
   - **Vector 2 (b, β)**: Second lattice vector in polar coordinates

2. **Optional Background**: Load a phase contrast image as reference
   - **Mouse drag**: Pan background
   - **Scroll wheel**: Zoom background
   - **Shift + drag**: Rotate background

3. **Export PNG**: Saves pattern only (white background with black squares) for use in registration

**Common Lattice Types**:
- **Square**: a=b, α=0°, β=90°
- **Hexagonal**: a=b, α=0°, β=60°
- **Oblique**: Custom angles

### Register Tab - Manual Registration

Align a template pattern to a phase contrast image:

1. **Load Images**: Click or drag-and-drop to load phase contrast (background) and template (overlay)
2. **Adjust Transform**:
   - **Mouse drag**: Pan template
   - **Scroll wheel**: Zoom template
   - **Shift + drag**: Rotate template
   - **Sliders**: Fine control over translation, rotation, scale
3. **Export JSON**: Download transform parameters

## Keyboard Shortcuts (Register Tab)

| Key | Action |
|-----|--------|
| Arrow keys | Fine pan (1px) |
| +/- | Fine zoom |
| [/] | Fine rotate |
| R | Reset transform |
| E | Export JSON |

## Export Formats

### Pattern Config (from Create tab)

```json
{
  "lattice": {
    "a": 50,
    "alpha": 0,
    "b": 50,
    "beta": 1.5707963267948966
  },
  "squareSize": 10
}
```

### Transform (from Register tab)

```json
{
  "tx": 10.5,
  "ty": -5.2,
  "rotation": 0.05,
  "scale": 1.02
}
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS 4
- HTML5 Canvas

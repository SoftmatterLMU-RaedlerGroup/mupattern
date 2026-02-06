# MuPattern

Standalone React app for microscopy pattern creation and registration, replacing manual Photoshop workflows.

## Quick Start

```bash
cd mupattern
bun install
bun run dev
```

Open http://localhost:5173

## Overview

MuPattern provides a unified canvas interface for creating tiled patterns using Bravais lattice parameters and aligning them to phase contrast microscopy images.

### Interface Layout

- **Left**: Live canvas preview with pattern overlay on phase contrast image
- **Right**: Collapsible sidebar with configuration sections

## Sidebar Sections

### Image

Load images and configurations:
- **Phase Contrast Image**: Drag-and-drop or click to load PNG background
- **Config Loader**: Load YAML configuration files to restore previous patterns

### Calibration

Set microscope objective calibration:
- **µm/pixel**: Direct numerical input (0.001–5.0)
- **Slider**: Logarithmic fine adjustment
- **Presets**: 10x (0.65), 20x (0.325), 40x (0.1625)
- **Drag Sensitivity**: Fine/Normal/Coarse control for mouse interactions

Calibration auto-saves to browser localStorage.

### Pattern

Configure Bravais lattice parameters:

| Parameter | Description | Range |
|-----------|-------------|-------|
| a | Vector 1 length | 1–200 µm |
| α (alpha) | Vector 1 angle | -180° to 180° |
| b | Vector 2 length | 1–200 µm |
| β (beta) | Vector 2 angle | -180° to 180° |
| Square Size | Pattern element size | 0.5–100 µm |

**Preset Buttons**:
- **Square**: Sets β = α + 90°
- **Hex**: Sets β = α + 60°

### Transform

Adjust pattern position:
- **Translate X/Y**: -500 to +500 pixels

## Canvas Interactions

| Mouse Action | Effect |
|--------------|--------|
| Left drag | Pan pattern |
| Middle drag | Scale pattern |
| Right drag | Rotate pattern |

### Visual Indicators

- **White dot**: Pattern origin
- **Red arrow**: Vector 1 (a, α)
- **Green arrow**: Vector 2 (b, β)
- **Blue squares**: Pattern cells
- **Red regions**: Overlapping cells (warning)
- **Crosshair**: Canvas center

## Export Formats

Click **Export** (enabled after loading an image) to download three files:

### 1. Pattern Template (`pattern-template.png`)

White squares on black background, matching input image dimensions. Flood-fill cleanup removes edge artifacts. Ready for pattern registration masks.

### 2. Bounding Boxes (`pattern-bboxes.csv`)

```csv
cell,x,y,w,h
0,125,340,25,25
1,200,340,25,25
...
```

Per-cell coordinates for programmatic pattern indexing. Only includes cells fully within image bounds.

### 3. Configuration (`pattern-config.yaml`)

```yaml
calibration:
  um_per_pixel: 0.6500

lattice:
  a: 75.0000
  alpha: 0.0000
  b: 75.0000
  beta: 90.0000

square_size: 25.0000
```

Human-readable snapshot of all pattern parameters. Angles stored in degrees.

## Common Lattice Types

| Type | Configuration |
|------|---------------|
| Square | a = b, β = α + 90° |
| Hexagonal | a = b, β = α + 60° |
| Oblique | Custom a, b, α, β |

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS 4
- shadcn/ui components
- HTML5 Canvas

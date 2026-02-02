export interface Transform {
  tx: number       // translation x (pixels)
  ty: number       // translation y (pixels)
  rotation: number // radians
  scale: number    // uniform scale factor
}

export const DEFAULT_TRANSFORM: Transform = {
  tx: 0,
  ty: 0,
  rotation: 0,
  scale: 1,
}

export interface Lattice {
  a: number     // length of vector 1 (pixels)
  alpha: number // angle of vector 1 (radians)
  b: number     // length of vector 2 (pixels)
  beta: number  // angle of vector 2 (radians)
}

export interface Pattern {
  lattice: Lattice
  squareSize: number // side length of square shape (pixels)
}

export const DEFAULT_LATTICE: Lattice = {
  a: 50,
  alpha: 0,            // 0°
  b: 50,
  beta: Math.PI / 2,   // 90° (square grid)
}

export const DEFAULT_PATTERN: Pattern = {
  lattice: DEFAULT_LATTICE,
  squareSize: 10,
}

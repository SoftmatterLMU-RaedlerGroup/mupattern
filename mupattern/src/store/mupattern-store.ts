/**
 * Central mupattern session store.
 * Persists to sessionStorage (survives reload, lost on tab close).
 * Only theme persists across tab close (handled by ThemeProvider).
 */

import { createPersistedStore } from "@/register/lib/persist"
import {
  DEFAULT_PATTERN_UM,
  DEFAULT_TRANSFORM,
  DEFAULT_CALIBRATION,
  type PatternConfigUm,
  type Transform,
  type Calibration,
  type Lattice,
} from "@/register/types"

// --- Register slice ---

export interface RegisterState {
  started: boolean
  imageDataURL: string | null
  imageBaseName: string
  canvasSize: { width: number; height: number }
  pattern: PatternConfigUm
  transform: Transform
  calibration: Calibration
  detectedPoints: Array<{ x: number; y: number }> | null
}

const defaultRegister: RegisterState = {
  started: false,
  imageDataURL: null,
  imageBaseName: "pattern",
  canvasSize: { width: 2048, height: 2048 },
  pattern: DEFAULT_PATTERN_UM,
  transform: DEFAULT_TRANSFORM,
  calibration: DEFAULT_CALIBRATION,
  detectedPoints: null,
}

// --- See slice ---

export interface SeeState {
  annotations: [string, boolean][]
  spots: [string, { y: number; x: number }[]][]
  selectedPos: string
  t: number
  c: number
  page: number
  contrastMin: number
  contrastMax: number
  annotating: boolean
  showAnnotations: boolean
  showSpots: boolean
  selectedPositions: string[]
}

const defaultSee: SeeState = {
  annotations: [],
  spots: [],
  selectedPos: "",
  t: 0,
  c: 0,
  page: 0,
  contrastMin: 0,
  contrastMax: 65535,
  annotating: false,
  showAnnotations: true,
  showSpots: true,
  selectedPositions: [],
}

// --- Combined state ---

export interface MupatternState {
  register: RegisterState
  see: SeeState
}

const defaultState: MupatternState = {
  register: defaultRegister,
  see: defaultSee,
}

export const mupatternStore = createPersistedStore<MupatternState>(
  "mupattern-session",
  defaultState,
  {
    debounceMs: 500,
    deserialize: (raw) => ({
      ...defaultState,
      ...(raw as Partial<MupatternState>),
      register: {
        ...defaultRegister,
        ...((raw as Partial<MupatternState>)?.register ?? {}),
        pattern: {
          ...defaultRegister.pattern,
          ...((raw as Partial<MupatternState>)?.register?.pattern ?? {}),
          lattice: {
            ...defaultRegister.pattern.lattice,
            ...((raw as Partial<MupatternState>)?.register?.pattern?.lattice ?? {}),
          },
        },
        transform: {
          ...defaultRegister.transform,
          ...((raw as Partial<MupatternState>)?.register?.transform ?? {}),
        },
        calibration: {
          ...defaultRegister.calibration,
          ...((raw as Partial<MupatternState>)?.register?.calibration ?? {}),
        },
      },
      see: {
        ...defaultSee,
        ...((raw as Partial<MupatternState>)?.see ?? {}),
      },
    }),
  }
)

// --- Register actions ---

export function startWithImage(
  imageDataURL: string,
  filename: string,
  width: number,
  height: number
) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      started: true,
      imageDataURL,
      imageBaseName: filename,
      canvasSize: { width, height },
    },
  }))
}

export function setPattern(pattern: PatternConfigUm) {
  mupatternStore.setState((s) => ({
    ...s,
    register: { ...s.register, pattern },
  }))
}

export function updateLattice(updates: Partial<Lattice>) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: {
        ...s.register.pattern,
        lattice: { ...s.register.pattern.lattice, ...updates },
      },
    },
  }))
}

export function updateWidth(width: number) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: { ...s.register.pattern, width },
    },
  }))
}

export function updateHeight(height: number) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: { ...s.register.pattern, height },
    },
  }))
}

export function scalePattern(factor: number) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: {
        ...s.register.pattern,
        lattice: {
          ...s.register.pattern.lattice,
          a: s.register.pattern.lattice.a * factor,
          b: s.register.pattern.lattice.b * factor,
        },
        width: s.register.pattern.width * factor,
        height: s.register.pattern.height * factor,
      },
    },
  }))
}

export function rotatePattern(deltaRad: number) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: {
        ...s.register.pattern,
        lattice: {
          ...s.register.pattern.lattice,
          alpha: s.register.pattern.lattice.alpha + deltaRad,
          beta: s.register.pattern.lattice.beta + deltaRad,
        },
      },
    },
  }))
}

export function updateTransform(updates: Partial<Transform>) {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      transform: { ...s.register.transform, ...updates },
    },
  }))
}

export function setCalibration(cal: Calibration) {
  if (cal.umPerPixel > 0) {
    mupatternStore.setState((s) => ({
      ...s,
      register: { ...s.register, calibration: cal },
    }))
  }
}

export function resetPatternAndTransform() {
  mupatternStore.setState((s) => ({
    ...s,
    register: {
      ...s.register,
      pattern: DEFAULT_PATTERN_UM,
      transform: DEFAULT_TRANSFORM,
    },
  }))
}

export function setDetectedPoints(points: Array<{ x: number; y: number }>) {
  mupatternStore.setState((s) => ({
    ...s,
    register: { ...s.register, detectedPoints: points },
  }))
}

export function clearDetectedPoints() {
  mupatternStore.setState((s) => ({
    ...s,
    register: { ...s.register, detectedPoints: null },
  }))
}

// --- See actions ---

export function setSeeAnnotations(annotations: Map<string, boolean>) {
  mupatternStore.setState((s) => ({
    ...s,
    see: {
      ...s.see,
      annotations: [...annotations.entries()],
    },
  }))
}

export function setSeeSelectedPos(selectedPos: string) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, selectedPos, page: 0 },
  }))
}

export function setSeeT(t: number) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, t },
  }))
}

export function setSeeC(c: number) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, c },
  }))
}

export function setSeePage(page: number) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, page },
  }))
}

export function setSeeContrast(contrastMin: number, contrastMax: number) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, contrastMin, contrastMax },
  }))
}

export function setSeeAnnotating(annotating: boolean) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, annotating },
  }))
}

export function setSeeSelectedPositions(selectedPositions: string[]) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, selectedPositions },
  }))
}

export function setSeeSpots(spots: Map<string, { y: number; x: number }[]>) {
  mupatternStore.setState((s) => ({
    ...s,
    see: {
      ...s.see,
      spots: [...spots.entries()],
    },
  }))
}

export function setSeeShowAnnotations(showAnnotations: boolean) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, showAnnotations },
  }))
}

export function setSeeShowSpots(showSpots: boolean) {
  mupatternStore.setState((s) => ({
    ...s,
    see: { ...s.see, showSpots },
  }))
}

export function getSeeAnnotationsMap(): Map<string, boolean> {
  return new Map(mupatternStore.state.see.annotations)
}

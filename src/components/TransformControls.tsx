import { Transform } from '../types'

interface TransformControlsProps {
  transform: Transform
  onUpdate: (updates: Partial<Transform>) => void
  onReset: () => void
  onExport: () => void
}

export function TransformControls({ transform, onUpdate, onReset, onExport }: TransformControlsProps) {
  const rotationDeg = (transform.rotation * 180) / Math.PI

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-800 rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Translation X: {transform.tx.toFixed(1)}px
          </label>
          <input
            type="range"
            min="-500"
            max="500"
            step="0.5"
            value={transform.tx}
            onChange={(e) => onUpdate({ tx: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Translation Y: {transform.ty.toFixed(1)}px
          </label>
          <input
            type="range"
            min="-500"
            max="500"
            step="0.5"
            value={transform.ty}
            onChange={(e) => onUpdate({ ty: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Rotation: {rotationDeg.toFixed(1)}°
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="0.1"
            value={rotationDeg}
            onChange={(e) => onUpdate({ rotation: (parseFloat(e.target.value) * Math.PI) / 180 })}
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            Scale: {transform.scale.toFixed(3)}x
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.001"
            value={transform.scale}
            onChange={(e) => onUpdate({ scale: parseFloat(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded text-sm transition-colors"
        >
          Reset (R)
        </button>
        <button
          onClick={onExport}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
        >
          Export JSON (E)
        </button>
      </div>

      <div className="text-zinc-500 text-xs">
        <div>Drag: Pan | Scroll: Zoom | Shift+Drag: Rotate</div>
        <div>Arrow keys: Fine pan | +/-: Zoom | [/]: Rotate</div>
      </div>
    </div>
  )
}

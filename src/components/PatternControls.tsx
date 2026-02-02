import { Pattern, Lattice } from '../types'

interface PatternControlsProps {
  pattern: Pattern
  onLatticeUpdate: (updates: Partial<Lattice>) => void
  onSquareSizeUpdate: (size: number) => void
  onReset: () => void
  onExport: () => void
}

export function PatternControls({
  pattern,
  onLatticeUpdate,
  onSquareSizeUpdate,
  onReset,
  onExport,
}: PatternControlsProps) {
  const { lattice, squareSize } = pattern
  const alphaDeg = (lattice.alpha * 180) / Math.PI
  const betaDeg = (lattice.beta * 180) / Math.PI

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-800 rounded-lg">
      <div className="text-zinc-300 text-sm font-medium border-b border-zinc-700 pb-2">
        Shape
      </div>
      <div>
        <label className="block text-zinc-400 text-xs mb-1">
          Square Size: {squareSize}px
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="1"
          value={squareSize}
          onChange={(e) => onSquareSizeUpdate(parseInt(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="text-zinc-300 text-sm font-medium border-b border-zinc-700 pb-2 mt-2">
        Lattice Vector 1
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            a (length): {lattice.a.toFixed(0)}px
          </label>
          <input
            type="range"
            min="10"
            max="200"
            step="1"
            value={lattice.a}
            onChange={(e) => onLatticeUpdate({ a: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            α (angle): {alphaDeg.toFixed(1)}°
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={alphaDeg}
            onChange={(e) => onLatticeUpdate({ alpha: (parseFloat(e.target.value) * Math.PI) / 180 })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      <div className="text-zinc-300 text-sm font-medium border-b border-zinc-700 pb-2 mt-2">
        Lattice Vector 2
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            b (length): {lattice.b.toFixed(0)}px
          </label>
          <input
            type="range"
            min="10"
            max="200"
            step="1"
            value={lattice.b}
            onChange={(e) => onLatticeUpdate({ b: parseInt(e.target.value) })}
            className="w-full accent-blue-500"
          />
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            β (angle): {betaDeg.toFixed(1)}°
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={betaDeg}
            onChange={(e) => onLatticeUpdate({ beta: (parseFloat(e.target.value) * Math.PI) / 180 })}
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={onReset}
          className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded text-sm transition-colors"
        >
          Reset
        </button>
        <button
          onClick={onExport}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors"
        >
          Export PNG
        </button>
      </div>

      <div className="text-zinc-500 text-xs mt-2">
        <div>Square: a=b, α=0°, β=90°</div>
        <div>Hexagonal: a=b, α=0°, β=60°</div>
      </div>
    </div>
  )
}

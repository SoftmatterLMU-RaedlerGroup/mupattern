import { useState, useEffect, useCallback, useRef } from 'react'
import { Tabs } from './components/Tabs'
import { FileLoader } from './components/FileLoader'
import { RegistrationCanvas } from './components/RegistrationCanvas'
import { TransformControls } from './components/TransformControls'
import { PatternCanvas, PatternCanvasRef } from './components/PatternCanvas'
import { PatternControls } from './components/PatternControls'
import { useTransform } from './hooks/useTransform'
import { usePattern } from './hooks/usePattern'

type Tab = 'create' | 'register'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('create')

  // Pattern creation state
  const patternCanvasRef = useRef<PatternCanvasRef>(null)
  const { pattern, updateLattice, updateSquareSize, reset: resetPattern } = usePattern()
  const [createBackground, setCreateBackground] = useState<HTMLImageElement | null>(null)
  const {
    transform: bgTransform,
    updateTransform: updateBgTransform,
    reset: resetBgTransform,
  } = useTransform()

  // Registration state
  const [regPhaseContrast, setRegPhaseContrast] = useState<HTMLImageElement | null>(null)
  const [template, setTemplate] = useState<HTMLImageElement | null>(null)
  const {
    transform: regTransform,
    updateTransform: updateRegTransform,
    reset: resetRegTransform,
    exportJSON,
  } = useTransform()

  const handleExportPNG = useCallback(() => {
    patternCanvasRef.current?.exportPNG()
  }, [])

  const handleResetCreate = useCallback(() => {
    resetPattern()
    resetBgTransform()
  }, [resetPattern, resetBgTransform])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (activeTab === 'register') {
      switch (e.key.toLowerCase()) {
        case 'r':
          resetRegTransform()
          break
        case 'e':
          exportJSON()
          break
        case 'arrowleft':
          updateRegTransform({ tx: regTransform.tx - 1 })
          break
        case 'arrowright':
          updateRegTransform({ tx: regTransform.tx + 1 })
          break
        case 'arrowup':
          updateRegTransform({ ty: regTransform.ty - 1 })
          break
        case 'arrowdown':
          updateRegTransform({ ty: regTransform.ty + 1 })
          break
        case '=':
        case '+':
          updateRegTransform({ scale: Math.min(2.0, regTransform.scale * 1.01) })
          break
        case '-':
          updateRegTransform({ scale: Math.max(0.5, regTransform.scale / 1.01) })
          break
        case '[':
          updateRegTransform({ rotation: regTransform.rotation - 0.01 })
          break
        case ']':
          updateRegTransform({ rotation: regTransform.rotation + 0.01 })
          break
      }
    }
  }, [activeTab, regTransform, updateRegTransform, resetRegTransform, exportJSON])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">MuPattern</h1>
          <p className="text-zinc-500 text-sm">
            {activeTab === 'create'
              ? 'Create tiled patterns for microscopy registration'
              : 'Align a template pattern to a phase contrast image'}
          </p>
        </div>
        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      </header>

      {activeTab === 'create' ? (
        <>
          <div className="flex gap-4 p-4 bg-zinc-800 rounded-lg">
            <div
              className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                createBackground ? 'border-green-500 bg-green-500/10' : 'border-zinc-600 hover:border-zinc-500'
              }`}
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                      const img = new Image()
                      img.onload = () => setCreateBackground(img)
                      img.src = ev.target?.result as string
                    }
                    reader.readAsDataURL(file)
                  }
                }
                input.click()
              }}
            >
              <div className="text-zinc-300 text-sm font-medium">
                {createBackground ? '✓ Background Loaded (Optional)' : 'Load Background (Optional)'}
              </div>
              <div className="text-zinc-500 text-xs mt-1">Phase contrast image for alignment reference</div>
            </div>
          </div>

          <div className="flex-1 flex gap-4 min-h-0">
            <PatternCanvas
              ref={patternCanvasRef}
              pattern={pattern}
              background={createBackground}
              backgroundTransform={bgTransform}
              onBackgroundTransformUpdate={updateBgTransform}
            />

            <div className="w-72 flex-shrink-0">
              <PatternControls
                pattern={pattern}
                onLatticeUpdate={updateLattice}
                onSquareSizeUpdate={updateSquareSize}
                onReset={handleResetCreate}
                onExport={handleExportPNG}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <FileLoader
            onPhaseContrastLoad={setRegPhaseContrast}
            onTemplateLoad={setTemplate}
            phaseContrastLoaded={!!regPhaseContrast}
            templateLoaded={!!template}
          />

          <div className="flex-1 flex gap-4 min-h-0">
            <RegistrationCanvas
              phaseContrast={regPhaseContrast}
              template={template}
              transform={regTransform}
              onTransformUpdate={updateRegTransform}
            />

            <div className="w-72 flex-shrink-0">
              <TransformControls
                transform={regTransform}
                onUpdate={updateRegTransform}
                onReset={resetRegTransform}
                onExport={exportJSON}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App

import { useState, useCallback, useRef, useMemo } from "react"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { UnifiedCanvas, type UnifiedCanvasRef } from "@/components/UnifiedCanvas"
import { usePattern } from "@/hooks/usePattern"
import { useTransform } from "@/hooks/useTransform"
import { useCalibration } from "@/hooks/useCalibration"
import { patternToPixels, patternToYAML } from "@/lib/units"

function App() {
  const canvasRef = useRef<UnifiedCanvasRef>(null)
  const [phaseContrast, setPhaseContrast] = useState<HTMLImageElement | null>(null)

  const { calibration, setCalibration } = useCalibration()
  const { pattern, updateLattice, updateSquareSize, scalePattern, rotatePattern, loadConfig, reset: resetPattern } = usePattern()
  const { transform, updateTransform, reset: resetTransform } = useTransform()
  const [sensitivity, setSensitivity] = useState(0.5)

  // Derive pixel-space pattern from µm config + calibration
  const patternPx = useMemo(
    () => patternToPixels(pattern, calibration),
    [pattern, calibration]
  )

  const handleReset = useCallback(() => {
    resetPattern()
    resetTransform()
  }, [resetPattern, resetTransform])

  const handleExportYAML = useCallback(() => {
    const yaml = patternToYAML(pattern, calibration)
    const blob = new Blob([yaml], { type: "text/yaml" })
    const link = document.createElement("a")
    link.download = "pattern-config.yaml"
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [pattern, calibration])

  const handleExport = useCallback(() => {
    canvasRef.current?.exportAll()
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 min-h-0">
        <UnifiedCanvas
          ref={canvasRef}
          phaseContrast={phaseContrast}
          patternPx={patternPx}
          transform={transform}
          onTransformUpdate={updateTransform}
          onZoom={scalePattern}
          onRotate={rotatePattern}
          sensitivity={sensitivity}
          onExportYAML={handleExportYAML}
        />
        <Sidebar
          imageLoaded={!!phaseContrast}
          onImageLoad={setPhaseContrast}
          onConfigLoad={loadConfig}
          calibration={calibration}
          onCalibrationChange={setCalibration}
          pattern={pattern}
          onLatticeUpdate={updateLattice}
          onSquareSizeUpdate={updateSquareSize}
          transform={transform}
          onTransformUpdate={updateTransform}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          onReset={handleReset}
          onExport={handleExport}
        />
      </div>
    </div>
  )
}

export default App

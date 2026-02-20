import { useCallback, useRef } from "react"
import { ChevronsUpDown, FileText } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { CalibrationControls } from "@/register/components/CalibrationControls"
import { PatternEditor } from "@/register/components/PatternEditor"
import { TransformEditor } from "@/register/components/TransformEditor"
import { ExportButton } from "@/register/components/ExportButton"
import { parseYAMLConfig } from "@/register/lib/units"
import type { Calibration, Lattice, PatternConfigUm, Transform } from "@/register/types"

interface SidebarProps {
  onConfigLoad: (config: PatternConfigUm) => void
  onCalibrationLoad: (cal: Calibration) => void
  calibration: Calibration
  onCalibrationChange: (cal: Calibration) => void
  pattern: PatternConfigUm
  onLatticeUpdate: (updates: Partial<Lattice>) => void
  onWidthUpdate: (width: number) => void
  onHeightUpdate: (height: number) => void
  transform: Transform
  onTransformUpdate: (updates: Partial<Transform>) => void
  onReset: () => void
  onExport: () => void
  hasImage: boolean
  hasDetectedPoints: boolean
  onDetect: () => void
  onFitGrid: (basisAngle: number) => void
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between py-1.5 text-base font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
          {title}
          <ChevronsUpDown className="h-3.5 w-3.5" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function Sidebar({
  onConfigLoad,
  onCalibrationLoad,
  calibration,
  onCalibrationChange,
  pattern,
  onLatticeUpdate,
  onWidthUpdate,
  onHeightUpdate,
  transform,
  onTransformUpdate,
  onReset,
  onExport,
  hasImage,
  hasDetectedPoints,
  onDetect,
  onFitGrid,
}: SidebarProps) {
  const configInputRef = useRef<HTMLInputElement>(null)

  const handleConfigFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const { pattern, calibration } = parseYAMLConfig(text)
        onConfigLoad(pattern)
        if (calibration) onCalibrationLoad(calibration)
      } catch {
        // silently fail
      }
    }
    reader.readAsText(file)
  }, [onConfigLoad, onCalibrationLoad])

  return (
    <aside className="w-80 flex-shrink-0 overflow-y-auto border-l border-border p-4 space-y-1">
      <Section title="Files">
        <div className="space-y-1.5">
          <input
            ref={configInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleConfigFile(f); e.target.value = "" }}
            className="hidden"
          />
          <Button variant="secondary" size="sm" className="w-full h-7 text-base" onClick={() => configInputRef.current?.click()}>
            <FileText className="size-3.5" />
            Load config
          </Button>
        </div>
      </Section>

      <Separator />

      <Section title="Calibration">
        <CalibrationControls
          calibration={calibration}
          onChange={onCalibrationChange}
        />
      </Section>

      <Separator />

      <Section title="Pattern">
        <PatternEditor
          pattern={pattern}
          onLatticeUpdate={onLatticeUpdate}
          onWidthUpdate={onWidthUpdate}
          onHeightUpdate={onHeightUpdate}
        />
      </Section>

      <Separator />

      <Section title="Transform">
        <TransformEditor
          transform={transform}
          onUpdate={onTransformUpdate}
        />
      </Section>

      <Separator />

      <div className="space-y-2 pt-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-7 text-base"
          disabled={!hasImage}
          onClick={onDetect}
        >
          Detect cells
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-7 text-base"
          disabled={!hasDetectedPoints}
          onClick={() => onFitGrid(Math.PI / 2)}
        >
          Auto square (a=b)
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full h-7 text-base"
          disabled={!hasDetectedPoints}
          onClick={() => onFitGrid(Math.PI / 3)}
        >
          Auto hex (a=b)
        </Button>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="sm" className="flex-1 h-7 text-base" onClick={onReset}>
            Reset
          </Button>
          <ExportButton onExport={onExport} />
        </div>
      </div>

    </aside>
  )
}

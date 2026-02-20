import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { clearAppSession } from "@/lib/clear-session"

export function LeftNav() {
  const handleHome = () => {
    clearAppSession()
    window.location.href = "/"
  }

  return (
    <aside className="w-48 flex-shrink-0 overflow-y-auto border-r border-border p-4">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={handleHome}
        title="Back to home (clears session)"
      >
        <Home className="size-4" />
        Home
      </Button>
    </aside>
  )
}

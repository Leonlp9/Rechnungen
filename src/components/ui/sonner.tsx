import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useAppStore } from "@/store"
import { useIsMobile } from "@/hooks/useIsMobile"

const Toaster = ({ ...props }: ToasterProps) => {
  const darkMode = useAppStore((s) => s.darkMode)
  const theme = darkMode ? "dark" : "light"
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
      // NACH dem Spread, damit es die Vorgabe aus App.tsx überschreibt:
      // auf dem Handy mittig unten, aber ÜBER der schwebenden
      // Navigationsleiste und innerhalb der Safe-Area. Vorher lagen die
      // Meldungen hinter der Leiste und waren halb verdeckt.
      position={isMobile ? "bottom-center" : props.position}
      mobileOffset={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + var(--toast-offset-bottom, 5.5rem))",
        left: "0.75rem",
        right: "0.75rem",
      }}
    />
  )
}

export { Toaster }

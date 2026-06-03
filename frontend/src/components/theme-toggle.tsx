import * as React from "react"
import { RiMoonClearLine, RiSunLine } from "@remixicon/react"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"

type ResolvedTheme = "dark" | "light"

function getSystemTheme(): ResolvedTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(COLOR_SCHEME_QUERY).matches
  ) {
    return "dark"
  }

  return "light"
}

export function ThemeToggle({
  className,
  showLabel = true,
}: {
  className?: string
  showLabel?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [systemTheme, setSystemTheme] =
    React.useState<ResolvedTheme>(getSystemTheme)

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    handleChange()
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme
  const isDark = resolvedTheme === "dark"

  const handleToggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "sm" : "icon-sm"}
      className={cn("border-border/90", showLabel && "gap-2", className)}
      onClick={handleToggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {isDark ? (
        <RiMoonClearLine data-icon="inline-start" aria-hidden="true" />
      ) : (
        <RiSunLine data-icon="inline-start" aria-hidden="true" />
      )}
      {showLabel ? <span>{isDark ? "Dark" : "Light"}</span> : null}
    </Button>
  )
}

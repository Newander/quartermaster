import type { CSSProperties, ReactNode } from "react"

import type { AppSection } from "@/lib/router"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

type ShellProps = {
  children: ReactNode
  user?: {
    email: string
    name: string
  }
  onLogout?: () => void
  title: string
  activeSection: AppSection | null
  onSectionChange: (section: AppSection) => void
}

export default function Shell({
  children,
  user,
  onLogout,
  title,
  activeSection,
  onSectionChange,
}: ShellProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        user={user}
        onLogout={onLogout}
        activeSection={activeSection ?? undefined}
        onSectionChange={onSectionChange}
      />
      <SidebarInset>
        <SiteHeader title={title} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

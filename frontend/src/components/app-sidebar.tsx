import * as React from "react"

import type { AppSection } from "@/lib/router"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { useMainNavigation } from "@/lib/main-navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type SidebarUser = {
  name: string
  email: string
}

export function AppSidebar({
  user,
  onLogout,
  activeSection,
  onSectionChange,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: SidebarUser
  onLogout?: () => void
  activeSection?: AppSection
  onSectionChange: (section: AppSection) => void
}) {
  const mainNavigationItems = useMainNavigation()
  const logoSrc = `${import.meta.env.BASE_URL}favicon.png`

  const sidebarUser = {
    name: user?.name ?? "HEMA Gardens",
    email: user?.email ?? "club@hema-garden.local",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard" className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border/80 bg-sidebar-primary/10 shadow-xs">
                  <img
                    src={logoSrc}
                    alt="Quartermaster logo"
                    className="size-6 object-contain"
                  />
                </span>
                <span className="text-base font-semibold">
                  Quartermaster CRM
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          activeItem={activeSection ?? ""}
          groups={mainNavigationItems}
          onSelect={(section) => onSectionChange(section as AppSection)}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={sidebarUser}
          onLogout={onLogout}
          isActive={activeSection === undefined}
        />
      </SidebarFooter>
    </Sidebar>
  )
}

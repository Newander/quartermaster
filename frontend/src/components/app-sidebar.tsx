import * as React from "react"

import {
  DEFAULT_AUTHENTICATED_ROUTE,
  toAppHref,
  type AppSection,
} from "@/lib/router"
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

  const handleBrandClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    onSectionChange("panel")
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-auto data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a
                href={toAppHref(DEFAULT_AUTHENTICATED_ROUTE)}
                className="flex items-center gap-2.5"
                onClick={handleBrandClick}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-sidebar-border/80 bg-sidebar-primary/10 shadow-xs">
                  <img
                    src={logoSrc}
                    alt="Quartermaster logo"
                    className="size-6 object-contain"
                  />
                </span>
                <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-base font-semibold">
                    Quartermaster CRM
                  </span>
                  <span className="truncate text-xs text-sidebar-foreground/65">
                    Demo operations
                  </span>
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
      <SidebarFooter className="border-t border-sidebar-border/70">
        <NavUser
          user={sidebarUser}
          onLogout={onLogout}
          isActive={activeSection === undefined}
        />
      </SidebarFooter>
    </Sidebar>
  )
}

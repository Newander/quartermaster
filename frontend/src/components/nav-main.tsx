import * as React from "react"
import { RiArrowDownSLine, RiCalendarScheduleFill } from "@remixicon/react"

import type { AppRoute } from "@/lib/router"
import { toAppHref } from "@/lib/router"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

const TRAINING_DROPDOWN_GROUP_TITLE = "Treningi"
const TRAINING_DROPDOWN_ITEM_IDS = new Set([
  "schedule",
  "harmonogram",
  "training-session-attendance",
  "training-session-sheet",
])

export function NavMain({
  groups,
  activeItem,
  onSelect,
}: {
  groups: {
    title: string
    items: {
      id: string
      title: string
      url: AppRoute
      icon?: React.ReactNode
    }[]
  }[]
  activeItem: string
  onSelect: (itemId: string) => void
}) {
  const [isTrainingDropdownOpen, setIsTrainingDropdownOpen] = React.useState(
    () => TRAINING_DROPDOWN_ITEM_IDS.has(activeItem)
  )

  React.useEffect(() => {
    if (TRAINING_DROPDOWN_ITEM_IDS.has(activeItem)) {
      setIsTrainingDropdownOpen(true)
    }
  }, [activeItem])

  const handleItemClick =
    (itemId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
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
      onSelect(itemId)
    }

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.title === TRAINING_DROPDOWN_GROUP_TITLE ? (
                <>
                  {group.items.some((item) =>
                    TRAINING_DROPDOWN_ITEM_IDS.has(item.id)
                  ) ? (
                    <Collapsible
                      open={isTrainingDropdownOpen}
                      onOpenChange={setIsTrainingDropdownOpen}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          tooltip="Treningi"
                          isActive={TRAINING_DROPDOWN_ITEM_IDS.has(activeItem)}
                        >
                          <RiCalendarScheduleFill />
                          <span>Treningi</span>
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction
                            aria-label="Pokaż lub ukryj sekcję Treningi"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                          >
                            <RiArrowDownSLine className="transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {group.items
                              .filter((item) =>
                                TRAINING_DROPDOWN_ITEM_IDS.has(item.id)
                              )
                              .map((item) => (
                                <SidebarMenuSubItem key={item.id}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={item.id === activeItem}
                                  >
                                    <a
                                      href={toAppHref(item.url)}
                                      onClick={handleItemClick(item.id)}
                                    >
                                      {item.icon}
                                      <span>{item.title}</span>
                                    </a>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  ) : null}
                  {group.items
                    .filter(
                      (item) => !TRAINING_DROPDOWN_ITEM_IDS.has(item.id)
                    )
                    .map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          tooltip={item.title}
                          isActive={item.id === activeItem}
                        >
                          <a
                            href={toAppHref(item.url)}
                            onClick={handleItemClick(item.id)}
                          >
                            {item.icon}
                            <span>{item.title}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                </>
              ) : (
                group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={item.id === activeItem}
                    >
                      <a
                        href={toAppHref(item.url)}
                        onClick={handleItemClick(item.id)}
                      >
                        {item.icon}
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}

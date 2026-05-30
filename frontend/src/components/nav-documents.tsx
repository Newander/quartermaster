"use client"

import * as React from "react"

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
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  RiArrowDownSLine,
  RiCalendarScheduleLine,
  RiFileLine,
  RiFolderLine,
  RiListUnordered,
  RiMoneyDollarCircleLine,
  RiSearchLine,
  RiSwordLine,
} from "@remixicon/react"

type StaticSectionItem = {
  id: string
  name: string
  icon: React.ReactNode
}

type StaticSectionGroup = {
  id: string
  name: string
  icon: React.ReactNode
  items: StaticSectionItem[]
}

const DOCUMENTS_OPEN_STATE_KEY = "sidebar_documents_open_state"

const STATIC_SECTION_GROUPS: StaticSectionGroup[] = [
  {
    id: "training-schedule",
    name: "Harmonogram treningów",
    icon: <RiCalendarScheduleLine />,
    items: [
      {
        id: "training-weekly",
        name: "Treningi tygodniowe",
        icon: <RiListUnordered />,
      },
      {
        id: "training-events",
        name: "Wydarzenia specjalne",
        icon: <RiCalendarScheduleLine />,
      },
      {
        id: "training-search",
        name: "Wyszukaj termin",
        icon: <RiSearchLine />,
      },
    ],
  },
  {
    id: "club-equipment",
    name: "Sprzęt klubowy",
    icon: <RiSwordLine />,
    items: [
      {
        id: "equipment-swords",
        name: "Broń treningowa",
        icon: <RiSwordLine />,
      },
      {
        id: "equipment-protection",
        name: "Sprzęt ochronny",
        icon: <RiFolderLine />,
      },
      {
        id: "equipment-inventory",
        name: "Inwentaryzacja",
        icon: <RiFileLine />,
      },
    ],
  },
  {
    id: "payments",
    name: "Płatności",
    icon: <RiMoneyDollarCircleLine />,
    items: [
      {
        id: "payments-membership",
        name: "Składki członkowskie",
        icon: <RiMoneyDollarCircleLine />,
      },
      {
        id: "payments-history",
        name: "Historia wpłat",
        icon: <RiFileLine />,
      },
      {
        id: "payments-overdue",
        name: "Zaległe płatności",
        icon: <RiSearchLine />,
      },
    ],
  },
  {
    id: "files-reports",
    name: "Pliki i raporty",
    icon: <RiFileLine />,
    items: [
      {
        id: "reports-monthly",
        name: "Raport miesięczny",
        icon: <RiFileLine />,
      },
      {
        id: "reports-regulations",
        name: "Regulaminy",
        icon: <RiFolderLine />,
      },
      {
        id: "reports-internal",
        name: "Dokumenty wewnętrzne",
        icon: <RiListUnordered />,
      },
    ],
  },
]

const readStoredOpenState = (): Record<string, boolean> => {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const rawValue = window.localStorage.getItem(DOCUMENTS_OPEN_STATE_KEY)
    if (!rawValue) {
      return {}
    }

    const parsedValue: unknown = JSON.parse(rawValue)
    if (!parsedValue || typeof parsedValue !== "object") {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsedValue).filter(([, isOpen]) => typeof isOpen === "boolean")
    )
  } catch {
    return {}
  }
}

export function NavDocuments({
  mainItems,
  activeItem,
  onSelect,
  items,
}: {
  mainItems: {
    id: string
    title: string
    url: AppRoute
    icon?: React.ReactNode
  }[]
  activeItem: string
  onSelect: (itemId: string) => void
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    readStoredOpenState
  )

  React.useEffect(() => {
    setOpenGroups((currentState) => {
      const nextState = { ...currentState }
      let hasChanges = false

      STATIC_SECTION_GROUPS.forEach((group, index) => {
        if (typeof nextState[group.id] === "boolean") {
          return
        }

        nextState[group.id] = index === 0
        hasChanges = true
      })

      return hasChanges ? nextState : currentState
    })
  }, [])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        DOCUMENTS_OPEN_STATE_KEY,
        JSON.stringify(openGroups)
      )
    } catch {
      // Ignore write errors (e.g. private mode restrictions).
    }
  }, [openGroups])

  const handleStaticItemClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
  }

  const handleMainItemClick =
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
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="text-sm font-semibold tracking-wide">
        Menu
      </SidebarGroupLabel>
      <SidebarMenu>
        {mainItems.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={item.id === activeItem}
            >
              <a
                href={toAppHref(item.url)}
                onClick={handleMainItemClick(item.id)}
              >
                {item.icon}
                <span>{item.title}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {items.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.url}>
                {item.icon}
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {STATIC_SECTION_GROUPS.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups[group.id] ?? false}
            onOpenChange={(isOpen) =>
              setOpenGroups((currentState) => ({
                ...currentState,
                [group.id]: isOpen,
              }))
            }
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <SidebarMenuButton className="text-sidebar-foreground/80">
                {group.icon}
                <span>{group.name}</span>
              </SidebarMenuButton>
              <CollapsibleTrigger asChild>
                <SidebarMenuAction
                  aria-label={`Pokaż lub ukryj sekcję: ${group.name}`}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <RiArrowDownSLine className="transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </SidebarMenuAction>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {group.items.map((item) => (
                    <SidebarMenuSubItem key={item.id}>
                      <SidebarMenuSubButton asChild>
                        <a href="#" onClick={handleStaticItemClick}>
                          {item.icon}
                          <span>{item.name}</span>
                        </a>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}

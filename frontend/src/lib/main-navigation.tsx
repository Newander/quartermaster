import { useEffect, useState, type ReactNode } from "react"
import {
  RiBankCard2Line,
  RiBookShelfLine,
  RiCalendarScheduleLine,
  RiDashboardLine,
  RiFolderUserLine,
  RiGitRepositoryLine,
  RiListUnordered,
  RiMedalLine,
  RiRefund2Fill,
  RiShieldUserLine,
  RiTableLine,
  RiTeamFill,
  RiUserSettingsLine,
  RiUserStarLine,
  type RemixiconComponentType,
} from "@remixicon/react"

import { api } from "@/lib/api-client"
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  getBaseRoute,
  type AppRoute,
  type AppSection,
} from "@/lib/router"

type NavigationDefinition = {
  id: AppSection
  title: string
  pageTitle: string
  url: AppRoute
  iconClass: RemixiconComponentType
  groupTitle: string
}

type NavigationResponseItem = {
  id: string
  title: string
  url: AppRoute
  icon: string
}

type NavigationResponse = {
  items: NavigationResponseItem[] | string[]
}

export type MainNavigationItem = NavigationDefinition & {
  icon: ReactNode
}

export type MainNavigationGroup = {
  title: string
  items: MainNavigationItem[]
}

const MAIN_NAVIGATION_DEFINITIONS: NavigationDefinition[] = [
  {
    id: "panel",
    title: "Panel",
    pageTitle: "Dashboard",
    url: "/dashboard",
    iconClass: RiDashboardLine,
    groupTitle: "Ogólne",
  },
  {
    id: "contract",
    title: "Dokumenty",
    pageTitle: "Dokumenty",
    url: "/contract",
    iconClass: RiListUnordered,
    groupTitle: "Klub",
  },
  {
    id: "member",
    title: "Członkowie",
    pageTitle: "Członkowie klubu",
    url: "/member",
    iconClass: RiTeamFill,
    groupTitle: "Klub",
  },
  {
    id: "instructor",
    title: "Instruktorzy",
    pageTitle: "Instruktorzy klubu",
    url: "/instructor",
    iconClass: RiGitRepositoryLine,
    groupTitle: "Klub",
  },
  {
    id: "schedule",
    title: "Tabela",
    pageTitle: "Tabela treningów",
    url: "/schedule",
    iconClass: RiTableLine,
    groupTitle: "Treningi",
  },
  {
    id: "harmonogram",
    title: "Harmonogram",
    pageTitle: "Harmonogram treningów",
    url: "/harmonogram",
    iconClass: RiCalendarScheduleLine,
    groupTitle: "Treningi",
  },
  {
    id: "training-form",
    title: "Formy treningowe",
    pageTitle: "Formy treningowe",
    url: "/training-form",
    iconClass: RiMedalLine,
    groupTitle: "Treningi",
  },
  {
    id: "season",
    title: "Sezony",
    pageTitle: "Sezony treningowe",
    url: "/season",
    iconClass: RiListUnordered,
    groupTitle: "Treningi",
  },
  {
    id: "training-session",
    title: "Sesje",
    pageTitle: "Sesje treningowe",
    url: "/training-session",
    iconClass: RiFolderUserLine,
    groupTitle: "Treningi",
  },
  {
    id: "training-session-attendance",
    title: "Obecności",
    pageTitle: "Obecności na treningach",
    url: "/training-session-attendance",
    iconClass: RiUserStarLine,
    groupTitle: "Treningi",
  },
  {
    id: "training-session-sheet",
    title: "Lista sesji",
    pageTitle: "Lista obecności sesji",
    url: "/training-session-sheet",
    iconClass: RiListUnordered,
    groupTitle: "Treningi",
  },
  {
    id: "public-device-identity",
    title: "Urządzenia publiczne",
    pageTitle: "Urządzenia publiczne",
    url: "/public-device-identity",
    iconClass: RiShieldUserLine,
    groupTitle: "Treningi",
  },
  {
    id: "attendance-change-log",
    title: "Historia obecności",
    pageTitle: "Historia zmian obecności",
    url: "/attendance-change-log",
    iconClass: RiListUnordered,
    groupTitle: "Treningi",
  },
  {
    id: "rack",
    title: "Stojaki",
    pageTitle: "Stojaki półek",
    url: "/shelf/racks",
    iconClass: RiBookShelfLine,
    groupTitle: "Półki",
  },
  {
    id: "shelf",
    title: "Półki",
    pageTitle: "Półki",
    url: "/shelf/shelves",
    iconClass: RiBookShelfLine,
    groupTitle: "Półki",
  },
  {
    id: "shelf-rental",
    title: "Wynajmy",
    pageTitle: "Wynajmy półek",
    url: "/shelf/rentals",
    iconClass: RiRefund2Fill,
    groupTitle: "Półki",
  },
  {
    id: "shelf-plan",
    title: "Plany",
    pageTitle: "Plany wynajmu półek",
    url: "/shelf/plans",
    iconClass: RiBankCard2Line,
    groupTitle: "Półki",
  },
  {
    id: "role",
    title: "Role",
    pageTitle: "Role systemowe",
    url: "/role",
    iconClass: RiShieldUserLine,
    groupTitle: "Administracja",
  },
  {
    id: "user",
    title: "Użytkownicy",
    pageTitle: "Użytkownicy systemu",
    url: "/user",
    iconClass: RiUserSettingsLine,
    groupTitle: "Administracja",
  },
]

const PAGE_TITLES: Partial<Record<AppRoute, string>> = {
  "/me": "My account",
  "/shelf": "Półki",
}

const navigationDefinitionsById = new Map(
  MAIN_NAVIGATION_DEFINITIONS.map((item) => [item.id, item])
)
const navigationDefinitionsByRoute = new Map(
  MAIN_NAVIGATION_DEFINITIONS.map((item) => [item.url, item])
)

const toMainNavigationItem = (
  item: NavigationDefinition
): MainNavigationItem => {
  const Icon = item.iconClass

  return {
    ...item,
    icon: <Icon className="size-4 shrink-0" aria-hidden="true" />,
  }
}

const isNavigationItemId = (value: string): value is AppSection =>
  navigationDefinitionsById.has(value as AppSection)

const isNavigationResponseItem = (
  value: NavigationResponseItem | string
): value is NavigationResponseItem => typeof value !== "string"

const toMainNavigationItems = (
  items: NavigationResponse["items"]
): MainNavigationItem[] =>
  items
    .map((item) => {
      if (isNavigationResponseItem(item)) {
        if (!isNavigationItemId(item.id)) {
          return null
        }

        const definition = navigationDefinitionsById.get(item.id)!

        return toMainNavigationItem({
          ...definition,
          title: item.title,
          pageTitle:
            navigationDefinitionsByRoute.get(item.url)?.pageTitle ?? item.title,
          url: item.url,
          groupTitle:
            navigationDefinitionsByRoute.get(item.url)?.groupTitle ??
            definition.groupTitle,
        })
      }

      if (!isNavigationItemId(item)) {
        return null
      }

      return toMainNavigationItem(navigationDefinitionsById.get(item)!)
    })
    .filter((item): item is MainNavigationItem => item !== null)

const toMainNavigationGroups = (
  items: MainNavigationItem[]
): MainNavigationGroup[] => {
  const groups = new Map<string, MainNavigationItem[]>()

  items.forEach((item) => {
    const currentItems = groups.get(item.groupTitle) ?? []
    currentItems.push(item)
    groups.set(item.groupTitle, currentItems)
  })

  return [...groups.entries()].map(([title, groupedItems]) => ({
    title,
    items: groupedItems,
  }))
}

export const getSectionFromRoute = (route: string): AppSection | null => {
  const resolvedRoute = getBaseRoute(route)
  return resolvedRoute
    ? (navigationDefinitionsByRoute.get(resolvedRoute)?.id ?? null)
    : null
}

export const getRouteForSection = (section: AppSection): AppRoute =>
  navigationDefinitionsById.get(section)?.url ?? DEFAULT_AUTHENTICATED_ROUTE

export const getTitleFromRoute = (route: string): string => {
  const resolvedRoute = getBaseRoute(route)

  if (!resolvedRoute) {
    return "Dashboard"
  }

  return (
    PAGE_TITLES[resolvedRoute] ??
    navigationDefinitionsByRoute.get(resolvedRoute)?.pageTitle ??
    "Dashboard"
  )
}

export function useMainNavigation() {
  const [items, setItems] = useState<MainNavigationGroup[]>(
    toMainNavigationGroups(
      MAIN_NAVIGATION_DEFINITIONS.map(toMainNavigationItem)
    )
  )

  useEffect(() => {
    let isMounted = true

    const loadNavigation = async () => {
      try {
        const response = await api.get<NavigationResponse>("/navigate")
        if (!isMounted) {
          return
        }

        setItems(toMainNavigationGroups(toMainNavigationItems(response.items)))
      } catch {
        if (isMounted) {
          setItems(
            toMainNavigationGroups(
              MAIN_NAVIGATION_DEFINITIONS.map(toMainNavigationItem)
            )
          )
        }
      }
    }

    void loadNavigation()

    return () => {
      isMounted = false
    }
  }, [])

  return items
}

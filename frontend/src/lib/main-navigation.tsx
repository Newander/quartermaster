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
    title: "Dashboard",
    pageTitle: "Dashboard",
    url: "/dashboard",
    iconClass: RiDashboardLine,
    groupTitle: "General",
  },
  {
    id: "contract",
    title: "Documents",
    pageTitle: "Documents",
    url: "/contract",
    iconClass: RiListUnordered,
    groupTitle: "Club",
  },
  {
    id: "member",
    title: "Members",
    pageTitle: "Club members",
    url: "/member",
    iconClass: RiTeamFill,
    groupTitle: "Club",
  },
  {
    id: "instructor",
    title: "Instructors",
    pageTitle: "Club instructors",
    url: "/instructor",
    iconClass: RiGitRepositoryLine,
    groupTitle: "Club",
  },
  {
    id: "schedule",
    title: "Schedule table",
    pageTitle: "Training schedule table",
    url: "/schedule",
    iconClass: RiTableLine,
    groupTitle: "Training",
  },
  {
    id: "harmonogram",
    title: "Calendar",
    pageTitle: "Training calendar",
    url: "/harmonogram",
    iconClass: RiCalendarScheduleLine,
    groupTitle: "Training",
  },
  {
    id: "training-form",
    title: "Training forms",
    pageTitle: "Training forms",
    url: "/training-form",
    iconClass: RiMedalLine,
    groupTitle: "Training",
  },
  {
    id: "season",
    title: "Seasons",
    pageTitle: "Training seasons",
    url: "/season",
    iconClass: RiListUnordered,
    groupTitle: "Training",
  },
  {
    id: "training-session",
    title: "Sessions",
    pageTitle: "Training sessions",
    url: "/training-session",
    iconClass: RiFolderUserLine,
    groupTitle: "Training",
  },
  {
    id: "training-session-attendance",
    title: "Attendance",
    pageTitle: "Training attendance",
    url: "/training-session-attendance",
    iconClass: RiUserStarLine,
    groupTitle: "Training",
  },
  {
    id: "training-session-sheet",
    title: "Session roster",
    pageTitle: "Session attendance roster",
    url: "/training-session-sheet",
    iconClass: RiListUnordered,
    groupTitle: "Training",
  },
  {
    id: "public-device-identity",
    title: "Public devices",
    pageTitle: "Public devices",
    url: "/public-device-identity",
    iconClass: RiShieldUserLine,
    groupTitle: "Training",
  },
  {
    id: "attendance-change-log",
    title: "Attendance history",
    pageTitle: "Attendance change history",
    url: "/attendance-change-log",
    iconClass: RiListUnordered,
    groupTitle: "Training",
  },
  {
    id: "rack",
    title: "Racks",
    pageTitle: "Shelf racks",
    url: "/shelf/racks",
    iconClass: RiBookShelfLine,
    groupTitle: "Shelves",
  },
  {
    id: "shelf",
    title: "Shelves",
    pageTitle: "Shelves",
    url: "/shelf/shelves",
    iconClass: RiBookShelfLine,
    groupTitle: "Shelves",
  },
  {
    id: "shelf-rental",
    title: "Rentals",
    pageTitle: "Shelf rentals",
    url: "/shelf/rentals",
    iconClass: RiRefund2Fill,
    groupTitle: "Shelves",
  },
  {
    id: "shelf-plan",
    title: "Plans",
    pageTitle: "Shelf rental plans",
    url: "/shelf/plans",
    iconClass: RiBankCard2Line,
    groupTitle: "Shelves",
  },
  {
    id: "role",
    title: "Roles",
    pageTitle: "System roles",
    url: "/role",
    iconClass: RiShieldUserLine,
    groupTitle: "Administration",
  },
  {
    id: "user",
    title: "Users",
    pageTitle: "System users",
    url: "/user",
    iconClass: RiUserSettingsLine,
    groupTitle: "Administration",
  },
]

const PAGE_TITLES: Partial<Record<AppRoute, string>> = {
  "/me": "My account",
  "/shelf": "Shelves",
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

import type { ElementType } from "react"
import { RiMore2Line } from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type DataTableRowActionIcon = ElementType

export type DataTableRowAction<TData> = {
  label: string
  icon?: DataTableRowActionIcon
  onSelect?: (row: TData) => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

type DataTableRowActionsProps<TData> = {
  row: TData
  actions: DataTableRowAction<TData>[]
}

export function DataTableRowActions<TData>({
  row,
  actions,
}: DataTableRowActionsProps<TData>) {
  const regularActions = actions.filter((action) => action.variant !== "destructive")
  const destructiveActions = actions.filter(
    (action) => action.variant === "destructive"
  )

  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground data-[state=open]:bg-muted"
          >
            <RiMore2Line data-icon="inline-start" />
            <span className="sr-only">Otwórz menu akcji</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {regularActions.length > 0 ? (
            <DropdownMenuGroup>
              {regularActions.map((action) => {
                const Icon = action.icon

                return (
                  <DropdownMenuItem
                    key={action.label}
                    disabled={action.disabled}
                    onSelect={() => action.onSelect?.(row)}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          ) : null}
          {regularActions.length > 0 && destructiveActions.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {destructiveActions.length > 0 ? (
            <DropdownMenuGroup>
              {destructiveActions.map((action) => {
                const Icon = action.icon

                return (
                  <DropdownMenuItem
                    key={action.label}
                    variant="destructive"
                    disabled={action.disabled}
                    onSelect={() => action.onSelect?.(row)}
                  >
                    {Icon ? <Icon /> : null}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

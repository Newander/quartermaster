import * as React from "react"
import { RiArrowDownSLine, RiCheckLine, RiLoader4Line } from "@remixicon/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { api } from "@/lib/api-client"
import { cn } from "@/lib/utils"

export type PublicMemberSearchRecord = {
  id: number
  first_name: string
  last_name: string
  display_hint: string
}

type PublicMemberSearchResponse = {
  records: PublicMemberSearchRecord[]
}

type PublicMemberSearchSelectProps = {
  value?: PublicMemberSearchRecord | null
  disabled?: boolean
  onSelect: (member: PublicMemberSearchRecord) => void
}

export function PublicMemberSearchSelect({
  value,
  disabled,
  onSelect,
}: PublicMemberSearchSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [records, setRecords] = React.useState<PublicMemberSearchRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const normalizedQuery = query.trim()
    if (!open || normalizedQuery.length < 1) {
      setRecords([])
      setIsLoading(false)
      return
    }

    let isCancelled = false
    const abortController = new AbortController()

    const loadMembers = async () => {
      setIsLoading(true)
      try {
        const response = await api.get<PublicMemberSearchResponse>(
          "/public/attendance/member-search",
          {
            auth: false,
            query: { q: normalizedQuery },
            signal: abortController.signal,
          }
        )
        if (!isCancelled) {
          setRecords(response.records)
        }
      } catch (error) {
        if (!isCancelled && !(error instanceof DOMException)) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Nie udało się znaleźć uczestników."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    const timeoutId = window.setTimeout(() => void loadMembers(), 250)
    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
      abortController.abort()
    }
  }, [open, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {value?.display_hint ?? "Wybierz uczestnika"}
          </span>
          <RiArrowDownSLine data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(28rem,var(--radix-popover-trigger-width))] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Szukaj po imieniu lub nazwisku..."
          />
          <CommandList>
            <CommandEmpty>
              {query.trim().length < 1
                ? "Wpisz imię lub nazwisko."
                : isLoading
                  ? "Ładowanie uczestników..."
                  : "Nie znaleziono uczestników."}
            </CommandEmpty>
            {records.length > 0 ? (
              <CommandGroup>
                <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs text-muted-foreground">
                  <span>Wyniki wyszukiwania</span>
                  <Badge variant="outline">{records.length}</Badge>
                </div>
                {records.map((record) => {
                  const isSelected = value?.id === record.id

                  return (
                    <CommandItem
                      key={record.id}
                      value={String(record.id)}
                      onSelect={() => {
                        onSelect(record)
                        setOpen(false)
                        setQuery("")
                      }}
                    >
                      <RiCheckLine
                        className={cn(
                          "opacity-0",
                          isSelected && "opacity-100"
                        )}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {record.display_hint}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uczestnik #{record.id}
                        </p>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ) : null}
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <RiLoader4Line className="animate-spin" aria-hidden="true" />
                Ładowanie...
              </div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

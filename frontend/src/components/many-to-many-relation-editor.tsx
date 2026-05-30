import * as React from "react"
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiLinkM,
  RiSearchLine,
} from "@remixicon/react"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type LookupPrimitive = string | number

type ManyToManyRelationOption = {
  value: LookupPrimitive
  label: string
}

type ManyToManyRelationEditorProps = {
  id: string
  options: ManyToManyRelationOption[]
  selectedValues: string[]
  analysisKey: string | number
  isLoading?: boolean
  disabled?: boolean
  onChange: (nextSelectedValues: string[]) => void
}

type RelationRow = {
  key: string
  label: string
  unresolved?: boolean
}

const PAGE_SIZE = 8

const normalizeSearch = (value: string) => value.trim().toLowerCase()

const filterRows = (rows: RelationRow[], query: string) => {
  const normalizedQuery = normalizeSearch(query)
  if (!normalizedQuery) {
    return rows
  }

  return rows.filter((row) =>
    `${row.label} ${row.key}`.toLowerCase().includes(normalizedQuery)
  )
}

const clampPage = (page: number, pageCount: number) => {
  if (pageCount <= 1) {
    return 0
  }
  return Math.min(Math.max(page, 0), pageCount - 1)
}

function RelationTable({
  tableId,
  title,
  description,
  query,
  onQueryChange,
  rows,
  selectedSet,
  page,
  pageCount,
  onPrevPage,
  onNextPage,
  onToggleRow,
  onTogglePageRows,
  disabled,
  isLoading,
  emptyTitle,
  emptyDescription,
}: {
  tableId: string
  title: string
  description: string
  query: string
  onQueryChange: (value: string) => void
  rows: RelationRow[]
  selectedSet: Set<string>
  page: number
  pageCount: number
  onPrevPage: () => void
  onNextPage: () => void
  onToggleRow: (rowKey: string) => void
  onTogglePageRows: (checked: boolean) => void
  disabled?: boolean
  isLoading?: boolean
  emptyTitle: string
  emptyDescription: string
}) {
  const pageRows = React.useMemo(() => {
    const offset = page * PAGE_SIZE
    return rows.slice(offset, offset + PAGE_SIZE)
  }, [page, rows])

  const areAllPageRowsSelected =
    pageRows.length > 0 && pageRows.every((row) => selectedSet.has(row.key))
  const areSomePageRowsSelected =
    !areAllPageRowsSelected && pageRows.some((row) => selectedSet.has(row.key))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Badge variant="outline">{rows.length}</Badge>
        </div>
        <div className="relative">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${tableId}-search`}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Szukaj..."
            className="h-8 pl-8"
            disabled={disabled || isLoading}
          />
        </div>
      </div>

      {rows.length === 0 && !isLoading ? (
        <Empty className="flex-1 rounded-lg border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiLinkM />
            </EmptyMedia>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <ScrollArea className="h-72 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        areAllPageRowsSelected ||
                        (areSomePageRowsSelected && "indeterminate")
                      }
                      onCheckedChange={(checked) =>
                        onTogglePageRows(checked === true)
                      }
                      aria-label={`Zaznacz wszystkie na stronie (${title})`}
                      disabled={disabled || isLoading || pageRows.length === 0}
                    />
                  </TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead className="w-24">ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Ładowanie opcji...
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((row) => {
                    const isChecked = selectedSet.has(row.key)

                    return (
                      <TableRow
                        key={`${tableId}-${row.key}`}
                        data-state={isChecked ? "selected" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => onToggleRow(row.key)}
                            aria-label={`Przełącz ${row.label}`}
                            disabled={disabled || isLoading}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{row.label}</span>
                            {row.unresolved ? (
                              <Badge variant="destructive">niedostępne</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs text-muted-foreground">{row.key}</code>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Strona {page + 1} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onPrevPage}
                disabled={disabled || isLoading || page <= 0}
                aria-label={`Poprzednia strona (${title})`}
              >
                <RiArrowLeftLine />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={onNextPage}
                disabled={disabled || isLoading || page >= pageCount - 1}
                aria-label={`Następna strona (${title})`}
              >
                <RiArrowRightLine />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ManyToManyRelationEditor({
  id,
  options,
  selectedValues,
  analysisKey,
  isLoading,
  disabled,
  onChange,
}: ManyToManyRelationEditorProps) {
  const isMobile = useIsMobile()
  const [availableQuery, setAvailableQuery] = React.useState("")
  const [linkedQuery, setLinkedQuery] = React.useState("")
  const [availableSelection, setAvailableSelection] = React.useState<Set<string>>(
    new Set()
  )
  const [linkedSelection, setLinkedSelection] = React.useState<Set<string>>(
    new Set()
  )
  const [availablePage, setAvailablePage] = React.useState(0)
  const [linkedPage, setLinkedPage] = React.useState(0)
  const [baselineValues, setBaselineValues] = React.useState<string[]>(
    selectedValues
  )
  const internalUpdateRef = React.useRef(false)
  const lastAnalysisKeyRef = React.useRef(analysisKey)

  const optionRows = React.useMemo<RelationRow[]>(() => {
    const uniqueRows = new Map<string, RelationRow>()
    for (const option of options) {
      const normalizedValue = String(option.value)
      if (uniqueRows.has(normalizedValue)) {
        continue
      }
      uniqueRows.set(normalizedValue, {
        key: normalizedValue,
        label: option.label,
      })
    }

    return Array.from(uniqueRows.values())
  }, [options])

  const optionValueSet = React.useMemo(
    () => new Set(optionRows.map((row) => row.key)),
    [optionRows]
  )
  const optionMapByKey = React.useMemo(
    () => new Map(optionRows.map((row) => [row.key, row])),
    [optionRows]
  )
  const selectedValueSet = React.useMemo(
    () => new Set(selectedValues),
    [selectedValues]
  )

  React.useEffect(() => {
    const analysisChanged = lastAnalysisKeyRef.current !== analysisKey
    if (analysisChanged) {
      lastAnalysisKeyRef.current = analysisKey
      setBaselineValues(selectedValues)
      setAvailableSelection(new Set())
      setLinkedSelection(new Set())
      setAvailablePage(0)
      setLinkedPage(0)
      setAvailableQuery("")
      setLinkedQuery("")
      internalUpdateRef.current = false
      return
    }

    if (internalUpdateRef.current) {
      internalUpdateRef.current = false
      return
    }

    setBaselineValues(selectedValues)
  }, [analysisKey, selectedValues])

  const availableRows = React.useMemo(
    () => optionRows.filter((row) => !selectedValueSet.has(row.key)),
    [optionRows, selectedValueSet]
  )

  const linkedRows = React.useMemo<RelationRow[]>(() => {
    return selectedValues.map((value) => {
      const mappedOption = optionMapByKey.get(value)

      return mappedOption
        ? mappedOption
        : {
            key: value,
            label: value,
            unresolved: true,
          }
    })
  }, [optionMapByKey, selectedValues])

  React.useEffect(() => {
    const availableKeys = new Set(availableRows.map((row) => row.key))
    setAvailableSelection((current) => {
      const next = new Set<string>()
      for (const selectedKey of current) {
        if (availableKeys.has(selectedKey)) {
          next.add(selectedKey)
        }
      }
      return next
    })
  }, [availableRows])

  React.useEffect(() => {
    const linkedKeys = new Set(linkedRows.map((row) => row.key))
    setLinkedSelection((current) => {
      const next = new Set<string>()
      for (const selectedKey of current) {
        if (linkedKeys.has(selectedKey)) {
          next.add(selectedKey)
        }
      }
      return next
    })
  }, [linkedRows])

  const filteredAvailableRows = React.useMemo(
    () => filterRows(availableRows, availableQuery),
    [availableRows, availableQuery]
  )
  const filteredLinkedRows = React.useMemo(
    () => filterRows(linkedRows, linkedQuery),
    [linkedRows, linkedQuery]
  )

  const availablePageCount = Math.max(
    Math.ceil(filteredAvailableRows.length / PAGE_SIZE),
    1
  )
  const linkedPageCount = Math.max(Math.ceil(filteredLinkedRows.length / PAGE_SIZE), 1)

  React.useEffect(() => {
    setAvailablePage((current) => clampPage(current, availablePageCount))
  }, [availablePageCount])
  React.useEffect(() => {
    setLinkedPage((current) => clampPage(current, linkedPageCount))
  }, [linkedPageCount])

  const applyNextSelectedValues = (nextValues: string[]) => {
    internalUpdateRef.current = true
    onChange(nextValues)
  }

  const toggleAvailableSelection = (rowKey: string) => {
    if (disabled || isLoading) {
      return
    }

    setAvailableSelection((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }
      return next
    })
  }

  const toggleLinkedSelection = (rowKey: string) => {
    if (disabled || isLoading) {
      return
    }

    setLinkedSelection((current) => {
      const next = new Set(current)
      if (next.has(rowKey)) {
        next.delete(rowKey)
      } else {
        next.add(rowKey)
      }
      return next
    })
  }

  const toggleAvailablePageRows = (checked: boolean) => {
    if (disabled || isLoading) {
      return
    }

    const start = availablePage * PAGE_SIZE
    const pageRows = filteredAvailableRows.slice(start, start + PAGE_SIZE)

    setAvailableSelection((current) => {
      const next = new Set(current)
      for (const row of pageRows) {
        if (checked) {
          next.add(row.key)
        } else {
          next.delete(row.key)
        }
      }
      return next
    })
  }

  const toggleLinkedPageRows = (checked: boolean) => {
    if (disabled || isLoading) {
      return
    }

    const start = linkedPage * PAGE_SIZE
    const pageRows = filteredLinkedRows.slice(start, start + PAGE_SIZE)

    setLinkedSelection((current) => {
      const next = new Set(current)
      for (const row of pageRows) {
        if (checked) {
          next.add(row.key)
        } else {
          next.delete(row.key)
        }
      }
      return next
    })
  }

  const appendSelectedValues = (valuesToAppend: string[]) => {
    const nextValues = [...selectedValues]
    const knownValues = new Set(selectedValues)
    for (const value of valuesToAppend) {
      if (knownValues.has(value)) {
        continue
      }
      knownValues.add(value)
      nextValues.push(value)
    }
    applyNextSelectedValues(nextValues)
  }

  const removeSelectedValues = (valuesToRemove: string[]) => {
    const valuesToRemoveSet = new Set(valuesToRemove)
    applyNextSelectedValues(
      selectedValues.filter((value) => !valuesToRemoveSet.has(value))
    )
  }

  const addCheckedAvailable = () => {
    appendSelectedValues(
      availableRows
        .filter((row) => availableSelection.has(row.key))
        .map((row) => row.key)
    )
    setAvailableSelection(new Set())
  }

  const addAllFiltered = () => {
    appendSelectedValues(filteredAvailableRows.map((row) => row.key))
    setAvailableSelection(new Set())
  }

  const removeCheckedLinked = () => {
    removeSelectedValues(
      linkedRows.filter((row) => linkedSelection.has(row.key)).map((row) => row.key)
    )
    setLinkedSelection(new Set())
  }

  const removeAllFiltered = () => {
    removeSelectedValues(filteredLinkedRows.map((row) => row.key))
    setLinkedSelection(new Set())
  }

  const clearAllLinks = () => {
    applyNextSelectedValues([])
    setAvailableSelection(new Set())
    setLinkedSelection(new Set())
  }

  const baselineSet = React.useMemo(() => new Set(baselineValues), [baselineValues])
  const addedValues = React.useMemo(
    () => selectedValues.filter((value) => !baselineSet.has(value)),
    [baselineSet, selectedValues]
  )
  const removedValues = React.useMemo(
    () => baselineValues.filter((value) => !selectedValueSet.has(value)),
    [baselineValues, selectedValueSet]
  )
  const unresolvedValues = React.useMemo(
    () => selectedValues.filter((value) => !optionValueSet.has(value)),
    [optionValueSet, selectedValues]
  )

  const availableTable = (
    <RelationTable
      tableId={`${id}-available`}
      title="Dostępne rekordy"
      description="Wybierz rekordy do powiązania."
      query={availableQuery}
      onQueryChange={setAvailableQuery}
      rows={filteredAvailableRows}
      selectedSet={availableSelection}
      page={availablePage}
      pageCount={availablePageCount}
      onPrevPage={() => setAvailablePage((current) => Math.max(current - 1, 0))}
      onNextPage={() =>
        setAvailablePage((current) => Math.min(current + 1, availablePageCount - 1))
      }
      onToggleRow={toggleAvailableSelection}
      onTogglePageRows={toggleAvailablePageRows}
      disabled={disabled}
      isLoading={isLoading}
      emptyTitle="Brak dostępnych rekordów"
      emptyDescription="Wszystkie rekordy są już powiązane lub filtr nie zwrócił wyników."
    />
  )

  const linkedTable = (
    <RelationTable
      tableId={`${id}-linked`}
      title="Powiązane rekordy"
      description="Rekordy zapisane do relacji N-M."
      query={linkedQuery}
      onQueryChange={setLinkedQuery}
      rows={filteredLinkedRows}
      selectedSet={linkedSelection}
      page={linkedPage}
      pageCount={linkedPageCount}
      onPrevPage={() => setLinkedPage((current) => Math.max(current - 1, 0))}
      onNextPage={() =>
        setLinkedPage((current) => Math.min(current + 1, linkedPageCount - 1))
      }
      onToggleRow={toggleLinkedSelection}
      onTogglePageRows={toggleLinkedPageRows}
      disabled={disabled}
      isLoading={isLoading}
      emptyTitle="Brak powiązań"
      emptyDescription="Dodaj rekordy z lewej tabeli, aby utworzyć relację."
    />
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || availableSelection.size === 0}
          onClick={addCheckedAvailable}
        >
          Dodaj zaznaczone ({availableSelection.size})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || filteredAvailableRows.length === 0}
          onClick={addAllFiltered}
        >
          Dodaj wszystkie z filtra ({filteredAvailableRows.length})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || linkedSelection.size === 0}
          onClick={removeCheckedLinked}
        >
          Usuń zaznaczone ({linkedSelection.size})
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || filteredLinkedRows.length === 0}
          onClick={removeAllFiltered}
        >
          Usuń wszystkie z filtra ({filteredLinkedRows.length})
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isLoading || selectedValues.length === 0}
          onClick={clearAllLinks}
        >
          Wyczyść relacje
        </Button>
      </div>

      {isMobile ? (
        <div className="grid gap-3">
          {availableTable}
          {linkedTable}
        </div>
      ) : (
        <div className="h-[31rem] overflow-hidden rounded-lg border">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full p-3">{availableTable}</div>
            </ResizablePanel>
            <ResizableHandle withHandle className="surface-handle" />
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full p-3">{linkedTable}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Powiązane
          </p>
          <p className="text-sm font-medium">{selectedValues.length}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Dodane
          </p>
          <p className="text-sm font-medium text-primary">{addedValues.length}</p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Usunięte
          </p>
          <p className="text-sm font-medium text-destructive">
            {removedValues.length}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Niedostępne
          </p>
          <p className="text-sm font-medium">{unresolvedValues.length}</p>
        </div>
      </div>
    </div>
  )
}

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  type PaginationState,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowUpSLine,
  RiArchiveLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiFilter3Line,
  RiLayoutColumnLine,
  RiMore2Line,
  RiRefreshLine,
  RiSearchLine,
} from "@remixicon/react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DataTableRowActions,
  type DataTableRowAction,
} from "@/components/data-table-row-actions"
import {
  RecordDetailSheet,
  type CustomFormField,
} from "@/components/record-detail-sheet"
import type {
  BackendApi,
  BackendQuery,
  ModelMeta,
  RelationLookup,
  RelationLookups,
  SchemaField,
  SchemaFieldType,
  SchemaFilter,
} from "@/lib/backend-api"
import { navigateTo } from "@/lib/router"
import { cn } from "@/lib/utils"

type DataTableProps<TData> = {
  api: BackendApi
  schemaRoute: string
  reloadKey?: string | number
  excludedColumns?: string[]
  readOnlyFields?: string[]
  emptyMessage?: string
  className?: string
  pageSize?: number
  withRowSelection?: boolean
  getRowId?: (row: TData, index: number) => string
  query?: BackendQuery
  filters?: BackendQuery | null
  rowActions?: DataTableRowAction<TData>[]
  schemaOverride?: ModelMeta
  customFields?: CustomFormField[]
  loadData?: (
    request: DataTableLoadRequest
  ) => Promise<DataTableLoadResponse<TData>>
  createRecord?: (
    payload: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  bulkDeleteRecords?: (records: TData[]) => Promise<void>
  syncRelations?: (
    recordId: number,
    relations: Record<string, unknown>
  ) => void | Promise<void>
  currentRoute?: string
  createRouteBase?: string
}

type ListResponse<TData> = {
  total: number
  records: TData[]
}

export type DataTableLoadRequest = {
  query?: BackendQuery
  filters: BackendQuery | null
  search: string
  pagination: PaginationState
  sorting: SortingState
  signal: AbortSignal
}

export type DataTableLoadResponse<TData> = {
  total: number
  records: TData[]
}

const toColumnLabel = (value: string) =>
  value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const parseDateValue = (value: string) => {
  const normalizedValue = value.trim()
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(normalizedValue)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const parsedDay = match[3] ? Number(match[3]) : 1
  const day =
    Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31
      ? parsedDay
      : 1
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  const parsedDate = new Date(year, month - 1, day)

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

const formatMonthCellValue = (value: string) => {
  const parsedDate = parseDateValue(value)
  if (!parsedDate) {
    return value
  }

  return new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(parsedDate)
}

const formatYearCellValue = (value: string) => {
  const parsedDate = parseDateValue(value)
  if (!parsedDate) {
    return value
  }

  return String(parsedDate.getFullYear())
}

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const getTableDisplayOptions = (field: SchemaField) => {
  const tableDisplay = isRecordObject(field.display?.table)
    ? field.display.table
    : null
  const maxWidth =
    typeof tableDisplay?.max_width === "string"
      ? tableDisplay.max_width
      : undefined

  return {
    maxWidth,
    truncate: tableDisplay?.truncate === true,
    tooltip: tableDisplay?.tooltip === true,
  }
}

const renderCellValue = (value: React.ReactNode, field: SchemaField) => {
  const display = getTableDisplayOptions(field)

  if (!display.maxWidth && !display.truncate && !display.tooltip) {
    return value
  }

  return (
    <span
      className={cn("block min-w-0", display.truncate && "truncate")}
      style={display.maxWidth ? { maxWidth: display.maxWidth } : undefined}
      title={display.tooltip ? String(value) : undefined}
    >
      {value}
    </span>
  )
}

const getRelationRecord = (
  row: Record<string, unknown>,
  fieldName: string,
  lookup: RelationLookup
) => {
  const candidateKeys = [
    lookup.foreign_table,
    lookup.foreign_key,
    fieldName.endsWith("_id") ? fieldName.slice(0, -3) : null,
  ].filter((key): key is string => Boolean(key))

  for (const key of candidateKeys) {
    const candidate = row[key]
    if (isRecordObject(candidate)) {
      return candidate
    }
  }

  return null
}

const formatRelationCellValue = (
  field: SchemaField,
  lookup: RelationLookup | undefined,
  row: unknown
) => {
  if (!lookup || !isRecordObject(row)) {
    return null
  }

  const relationRecord = getRelationRecord(row, field.name, lookup)
  if (!relationRecord) {
    return null
  }

  const label = relationRecord[lookup.label_field]
  if (label === null || label === undefined || label === "") {
    return null
  }

  return formatCellValue(label, field)
}

const formatCellValue = (value: unknown, field: SchemaField) => {
  if (value === null || value === undefined || value === "") {
    return "—"
  }

  if (field.ui_type === "month" && typeof value === "string") {
    return formatMonthCellValue(value)
  }

  if (field.ui_type === "year" && typeof value === "string") {
    return formatYearCellValue(value)
  }

  if (typeof value === "boolean") {
    return value ? "Tak" : "Nie"
  }

  if (typeof value === "number" || typeof value === "string") {
    return String(value)
  }

  return JSON.stringify(value)
}

const createLookupFieldMap = (lookups: RelationLookups | undefined) => {
  const mappedLookups: Record<string, RelationLookup> = {}

  for (const [lookupName, lookup] of Object.entries(lookups ?? {})) {
    if (!(lookupName in mappedLookups)) {
      mappedLookups[lookupName] = lookup
    }

    if (lookup.foreign_key && !(lookup.foreign_key in mappedLookups)) {
      mappedLookups[lookup.foreign_key] = lookup
    }
  }

  return mappedLookups
}

const filterInputTypeByFieldType = (type: SchemaFieldType) => {
  switch (type) {
    case "int":
    case "float":
    case "Decimal":
      return "number"
    case "date":
      return "date"
    case "datetime":
      return "datetime-local"
    case "time":
      return "time"
    default:
      return "text"
  }
}

const coerceFilterValue = (value: string, type: SchemaFieldType) => {
  if (!value || value === "__all") {
    return undefined
  }

  switch (type) {
    case "bool":
      if (value === "true") {
        return true
      }
      if (value === "false") {
        return false
      }
      return undefined
    case "int":
    case "float":
    case "Decimal": {
      const parsedValue = Number(value)

      return Number.isNaN(parsedValue) ? undefined : parsedValue
    }
    default:
      return value
  }
}

export function DataTable<TData>({
  api,
  schemaRoute,
  reloadKey,
  excludedColumns = [],
  readOnlyFields = excludedColumns,
  className,
  pageSize = 12,
  getRowId,
  withRowSelection = false,
  emptyMessage = "Brak danych.",
  query,
  filters,
  rowActions = [],
  schemaOverride,
  customFields,
  loadData,
  createRecord,
  bulkDeleteRecords,
  syncRelations,
  currentRoute,
  createRouteBase,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })
  const [schemaFields, setSchemaFields] = React.useState<SchemaField[]>([])
  const [schemaFilters, setSchemaFilters] = React.useState<SchemaFilter[]>([])
  const [schemaRelationLookups, setSchemaRelationLookups] =
    React.useState<RelationLookups>({})
  const [isSchemaLoading, setIsSchemaLoading] = React.useState(false)
  const [schemaError, setSchemaError] = React.useState<string | null>(null)
  const [records, setRecords] = React.useState<TData[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [isDataLoading, setIsDataLoading] = React.useState(false)
  const [dataError, setDataError] = React.useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
  const [isCreateSheetOpenLocal, setIsCreateSheetOpenLocal] =
    React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [toolbarFilters, setToolbarFilters] = React.useState<
    Record<string, string>
  >({})
  const [dataRevision, setDataRevision] = React.useState(0)

  const deferredSearchValue = React.useDeferredValue(searchValue)
  const requestSearchValue = React.useMemo(
    () => deferredSearchValue.trim(),
    [deferredSearchValue]
  )

  const normalizedRoute = React.useMemo(
    () => (schemaRoute.endsWith("/") ? schemaRoute.slice(0, -1) : schemaRoute),
    [schemaRoute]
  )
  const normalizedCreateRouteBase = React.useMemo(() => {
    if (!createRouteBase) {
      return null
    }

    return createRouteBase.endsWith("/")
      ? createRouteBase.slice(0, -1)
      : createRouteBase
  }, [createRouteBase])
  const createRoute = React.useMemo(
    () =>
      normalizedCreateRouteBase ? `${normalizedCreateRouteBase}/new` : null,
    [normalizedCreateRouteBase]
  )
  const isCreateSheetOpen = createRoute
    ? currentRoute === createRoute
    : isCreateSheetOpenLocal

  React.useEffect(() => {
    if (schemaOverride) {
      setSchemaFields(schemaOverride.fields)
      setSchemaFilters(
        Array.isArray(schemaOverride.filters) ? schemaOverride.filters : []
      )
      setSchemaRelationLookups(schemaOverride.relation_lookups ?? {})
      setSchemaError(null)
      setIsSchemaLoading(false)
      return
    }

    let isCancelled = false

    const loadSchema = async () => {
      setIsSchemaLoading(true)
      setSchemaError(null)

      try {
        const schema = await api.getSchema(normalizedRoute)

        if (!isCancelled) {
          setSchemaFields(schema.fields)
          setSchemaFilters(Array.isArray(schema.filters) ? schema.filters : [])
          setSchemaRelationLookups(schema.relation_lookups ?? {})
        }
      } catch (error) {
        if (!isCancelled) {
          setSchemaFields([])
          setSchemaFilters([])
          setSchemaRelationLookups({})
          setSchemaError(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać schematu tabeli."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsSchemaLoading(false)
        }
      }
    }

    void loadSchema()

    return () => {
      isCancelled = true
    }
  }, [api, normalizedRoute, schemaOverride])

  const toolbarFilterQuery = React.useMemo<BackendQuery>(() => {
    return schemaFilters.reduce<BackendQuery>((accumulator, [name, , type]) => {
      const value = coerceFilterValue(toolbarFilters[name] ?? "", type)

      if (value !== undefined) {
        accumulator[name] = value
      }

      return accumulator
    }, {})
  }, [schemaFilters, toolbarFilters])

  const defaultRouteFilters = React.useMemo<BackendQuery>(() => {
    const hasIsDeletedFilter = schemaFilters.some(
      ([name]) => name === "is_deleted"
    )
    const hasExplicitIsDeletedFilter =
      filters?.is_deleted !== undefined ||
      toolbarFilterQuery.is_deleted !== undefined

    if (!hasIsDeletedFilter || hasExplicitIsDeletedFilter) {
      return {}
    }

    return { is_deleted: false }
  }, [filters, schemaFilters, toolbarFilterQuery])

  const requestFilters = React.useMemo<BackendQuery | null>(() => {
    const mergedFilters = {
      ...defaultRouteFilters,
      ...(filters ?? {}),
      ...toolbarFilterQuery,
    }

    return Object.keys(mergedFilters).length > 0 ? mergedFilters : null
  }, [defaultRouteFilters, filters, toolbarFilterQuery])

  React.useEffect(() => {
    let isCancelled = false
    const abortController = new AbortController()

    const sortingEntry = sorting[0]

    const loadDataEffect = async () => {
      setIsDataLoading(true)
      setDataError(null)

      try {
        const response = loadData
          ? await loadData({
              query,
              filters: requestFilters,
              search: requestSearchValue,
              pagination: {
                pageIndex: pagination.pageIndex,
                pageSize: pagination.pageSize,
              },
              sorting,
              signal: abortController.signal,
            })
          : await api.client.get<ListResponse<TData>>(normalizedRoute, {
              query: {
                ...query,
                filters: requestFilters
                  ? JSON.stringify(requestFilters)
                  : undefined,
                search: requestSearchValue || undefined,
                skip: pagination.pageIndex * pagination.pageSize,
                limit: pagination.pageSize,
                order_by_col: sortingEntry?.id,
                order_by_asc:
                  sortingEntry?.desc === undefined
                    ? undefined
                    : sortingEntry.desc
                      ? "desc"
                      : "asc",
              },
              signal: abortController.signal,
            })

        if (!isCancelled) {
          setRecords(response.records)
          setTotalRows(response.total)
        }
      } catch (error) {
        if (!isCancelled && !abortController.signal.aborted) {
          setRecords([])
          setTotalRows(0)
          setDataError(
            error instanceof Error
              ? error.message
              : "Nie udało się pobrać danych tabeli."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsDataLoading(false)
        }
      }
    }

    void loadDataEffect()

    return () => {
      isCancelled = true
      abortController.abort()
    }
  }, [
    api,
    filters,
    normalizedRoute,
    pagination.pageIndex,
    pagination.pageSize,
    query,
    reloadKey,
    requestFilters,
    requestSearchValue,
    sorting,
    dataRevision,
    loadData,
  ])

  React.useEffect(() => {
    setRowSelection({})
  }, [reloadKey])

  React.useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    )
  }, [query, requestFilters, requestSearchValue, sorting])

  React.useEffect(() => {
    setPagination((current) =>
      current.pageSize === pageSize ? current : { pageIndex: 0, pageSize }
    )
  }, [pageSize])

  const excludedColumnSet = React.useMemo(
    () => new Set(excludedColumns),
    [excludedColumns]
  )
  const lookupByFieldName = React.useMemo(
    () => createLookupFieldMap(schemaRelationLookups),
    [schemaRelationLookups]
  )

  const schemaColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    return schemaFields
      .filter((field) => !excludedColumnSet.has(field.name))
      .map((field) => {
        const lookup = lookupByFieldName[field.name]

        return {
          accessorKey: field.name,
          header: toColumnLabel(field.transcription),
          cell: ({ row }) => {
            const value = row.getValue(field.name)
            const displayValue =
              formatRelationCellValue(field, lookup, row.original) ??
              formatCellValue(value, field)

            return renderCellValue(displayValue, field)
          },
          enableSorting: field.input_mode !== "derived",
        }
      })
  }, [excludedColumnSet, lookupByFieldName, schemaFields])
  const schemaColumnLabels = React.useMemo<Record<string, string>>(() => {
    return schemaFields.reduce<Record<string, string>>((accumulator, field) => {
      if (excludedColumnSet.has(field.name)) {
        return accumulator
      }

      accumulator[field.name] = toColumnLabel(field.transcription || field.name)

      return accumulator
    }, {})
  }, [excludedColumnSet, schemaFields])

  const actionsColumn = React.useMemo<ColumnDef<TData> | null>(() => {
    if (rowActions.length === 0) {
      return null
    }

    return {
      id: "actions",
      header: () => <div className="text-right">Akcje</div>,
      cell: ({ row }) => (
        <DataTableRowActions row={row.original} actions={rowActions} />
      ),
      enableSorting: false,
      enableHiding: false,
    }
  }, [rowActions])

  const resolvedColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    return actionsColumn ? [actionsColumn, ...schemaColumns] : schemaColumns
  }, [actionsColumn, schemaColumns])

  const tableColumns = React.useMemo<ColumnDef<TData>[]>(() => {
    if (!withRowSelection) {
      return resolvedColumns
    }

    const selectionColumn: ColumnDef<TData> = {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Zaznacz wszystkie wiersze"
            disabled={!table.getRowModel().rows.length}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Zaznacz wiersz"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    }

    return [selectionColumn, ...resolvedColumns]
  }, [resolvedColumns, withRowSelection])

  const table = useReactTable({
    data: records,
    columns: tableColumns,
    getRowId,
    state: { sorting, rowSelection, pagination, columnVisibility },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    enableRowSelection: withRowSelection,
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(Math.ceil(totalRows / pagination.pageSize), 1),
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedRowsCount = table.getSelectedRowModel().rows.length
  const activeFiltersCount = Object.keys(toolbarFilterQuery).length
  const selectedSchemaFilters = React.useMemo(
    () => schemaFilters.filter(([name]) => name in toolbarFilters),
    [schemaFilters, toolbarFilters]
  )
  const availableSchemaFilters = React.useMemo(
    () => schemaFilters.filter(([name]) => !(name in toolbarFilters)),
    [schemaFilters, toolbarFilters]
  )
  const hasToolbarState =
    searchValue.trim().length > 0 || selectedSchemaFilters.length > 0
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())
  const rowsPerPageOptions = React.useMemo(() => {
    return Array.from(new Set([10, 20, 30, 40, 50, pagination.pageSize])).sort(
      (a, b) => a - b
    )
  }, [pagination.pageSize])

  const handleCreate = () => {
    if (createRoute) {
      navigateTo(createRoute)
      return
    }

    setIsCreateSheetOpenLocal(true)
  }

  const handleBulkAction = (actionLabel: string) => {
    toast(
      `${actionLabel} dla ${selectedRowsCount} zaznaczonych rekordów będzie dostępne w kolejnym kroku.`
    )
  }

  const getRecordIdForDelete = React.useCallback(
    (record: TData, rowId: string) => {
      if (typeof record === "object" && record !== null && "id" in record) {
        const rawId = (record as Record<string, unknown>).id

        if (typeof rawId === "number" && Number.isInteger(rawId)) {
          return rawId
        }

        if (typeof rawId === "string") {
          const parsedId = Number(rawId)

          if (Number.isInteger(parsedId)) {
            return parsedId
          }
        }
      }

      const parsedRowId = Number(rowId)

      return Number.isInteger(parsedRowId) ? parsedRowId : null
    },
    []
  )

  const handleBulkDelete = async () => {
    const selectedRows = table.getSelectedRowModel().rows
    const selectedRecords = selectedRows.map((row) => row.original)

    if (selectedRecords.length === 0) {
      toast.error("Nie wybrano rekordów do usunięcia.")
      return
    }

    setIsBulkDeleting(true)

    try {
      if (bulkDeleteRecords) {
        await bulkDeleteRecords(selectedRecords)
      } else {
        const selectedIds = selectedRows.map((row) =>
          getRecordIdForDelete(row.original, row.id)
        )

        if (selectedIds.some((id) => id === null)) {
          throw new Error("Nie udało się ustalić identyfikatorów rekordów.")
        }

        await Promise.all(
          selectedIds.map((id) =>
            api.deleteByRoute(normalizedRoute, id as number)
          )
        )
      }

      toast.success(`Usunięto ${selectedRecords.length} zaznaczone rekordy.`)
      setRowSelection({})
      setDataRevision((current) => current + 1)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się usunąć zaznaczonych rekordów."
      )
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleFilterChange = (name: string, value: string) => {
    setToolbarFilters((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleFilterAdd = (name: string, type: SchemaFieldType) => {
    setToolbarFilters((current) => {
      if (name in current) {
        return current
      }

      return {
        ...current,
        [name]: type === "bool" ? "false" : "",
      }
    })
  }

  const handleFilterRemove = (name: string) => {
    setToolbarFilters((current) => {
      if (!(name in current)) {
        return current
      }

      const next = { ...current }
      delete next[name]
      return next
    })
  }

  const clearToolbarState = () => {
    setSearchValue("")
    setToolbarFilters({})
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid gap-2 rounded-lg border p-2.5 lg:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="relative">
            <RiSearchLine className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${normalizedRoute}-search`}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Szukaj w tabeli..."
              className="w-full pl-8"
            />
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          <div className="flex min-h-8 items-center gap-2 overflow-x-auto">
            {schemaFilters.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={availableSchemaFilters.length === 0}
                  >
                    <RiFilter3Line data-icon="inline-start" />
                    Dodaj filtr
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 min-w-56">
                  <DropdownMenuLabel>Dostępne filtry</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableSchemaFilters.length > 0 ? (
                    <DropdownMenuGroup>
                      {availableSchemaFilters.map(([name, label, type]) => (
                        <DropdownMenuItem
                          key={name}
                          onSelect={() => handleFilterAdd(name, type)}
                        >
                          <span>{label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ) : (
                    <DropdownMenuItem disabled>
                      Wszystkie filtry są już dodane
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                Brak filtrów w schemacie.
              </span>
            )}
            {selectedSchemaFilters.length > 0 ? (
              selectedSchemaFilters.map(([name, label, type]) => {
                const filterId = `${normalizedRoute}-${name}-filter`
                const isApplied = name in toolbarFilterQuery

                return (
                  <div
                    key={name}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-lg border bg-muted/30 px-1.5"
                  >
                    <Badge
                      variant={isApplied ? "secondary" : "outline"}
                      className="h-5"
                    >
                      {label}
                    </Badge>
                    {type === "bool" ? (
                      <label
                        htmlFor={filterId}
                        className="flex h-7 items-center gap-2 rounded-md px-1.5 text-sm"
                      >
                        <Checkbox
                          id={filterId}
                          checked={toolbarFilters[name] === "true"}
                          onCheckedChange={(checked) =>
                            handleFilterChange(
                              name,
                              checked === true ? "true" : "false"
                            )
                          }
                        />
                        <span className="min-w-8">
                          {toolbarFilters[name] === "true" ? "Tak" : "Nie"}
                        </span>
                      </label>
                    ) : (
                      <Input
                        id={filterId}
                        value={toolbarFilters[name] ?? ""}
                        onChange={(event) =>
                          handleFilterChange(name, event.target.value)
                        }
                        type={filterInputTypeByFieldType(type)}
                        placeholder="Wartość"
                        className="h-7 w-36 border-0 bg-transparent px-1.5 shadow-none focus-visible:ring-0"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      onClick={() => handleFilterRemove(name)}
                      aria-label={`Usuń filtr ${toColumnLabel(name)}`}
                      title={`Usuń filtr ${toColumnLabel(name)}`}
                    >
                      <RiCloseLine />
                    </Button>
                  </div>
                )
              })
            ) : (
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                Wybierz filtr z listy, aby dodać go do tabeli.
              </span>
            )}
            {activeFiltersCount > 0 ? (
              <Badge variant="secondary" className="h-5 shrink-0">
                {activeFiltersCount} aktywne
              </Badge>
            ) : null}
          </div>
        </div>
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center justify-end gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={hideableColumns.length === 0}
                >
                  <RiLayoutColumnLine data-icon="inline-start" />
                  Kolumny
                  <RiArrowDownSLine data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Widoczne kolumny</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {hideableColumns.length > 0 ? (
                    hideableColumns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {schemaColumnLabels[column.id] ??
                          toColumnLabel(column.id)}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      Brak kolumn do ukrywania
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="icon-sm"
                    onClick={handleCreate}
                    aria-label="Nowy element"
                  >
                    <RiAddLine />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Nowy element
              </TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={
                          withRowSelection && selectedRowsCount > 0
                            ? "default"
                            : "outline"
                        }
                        size="icon-sm"
                        className={cn(
                          withRowSelection &&
                            selectedRowsCount > 0 &&
                            "shadow-sm ring-1 shadow-primary/30 ring-primary/20"
                        )}
                        disabled={
                          !withRowSelection ||
                          selectedRowsCount === 0 ||
                          isBulkDeleting
                        }
                        aria-label="Akcje grupowe"
                      >
                        <RiMore2Line />
                      </Button>
                    </DropdownMenuTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {selectedRowsCount > 0
                    ? `Akcje grupowe (${selectedRowsCount})`
                    : "Akcje grupowe"}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  Zaznaczono {selectedRowsCount}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={() => handleBulkAction("Archiwizacja")}
                  >
                    <RiArchiveLine />
                    <span>Archiwizuj zaznaczone</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={isBulkDeleting}
                    onSelect={() => void handleBulkDelete()}
                  >
                    <RiDeleteBinLine />
                    <span>Usuń zaznaczone</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={clearToolbarState}
                    disabled={!hasToolbarState}
                    aria-label="Wyczyść wyszukiwanie i filtry"
                  >
                    <RiRefreshLine />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Wyczyść wyszukiwanie i filtry
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-border">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()

                  return (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder ? null : canSort ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() === "asc" ? (
                            <RiArrowUpSLine data-icon="inline-end" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <RiArrowDownSLine data-icon="inline-end" />
                          ) : null}
                        </Button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isSchemaLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  Ładowanie schematu tabeli...
                </TableCell>
              </TableRow>
            ) : schemaError ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-destructive"
                >
                  {schemaError}
                </TableCell>
              </TableRow>
            ) : isDataLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  Ładowanie danych...
                </TableCell>
              </TableRow>
            ) : dataError ? (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-destructive"
                >
                  {dataError}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length || 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-sm text-muted-foreground">
          {withRowSelection
            ? `Wybrano ${selectedRowsCount} z ${totalRows}`
            : deferredSearchValue.trim()
              ? `${table.getRowModel().rows.length} z ${totalRows} rekordów`
              : `${totalRows} rekordów`}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <Label
              htmlFor={`${normalizedRoute}-rows-per-page`}
              className="text-sm font-medium"
            >
              Wierszy na stronę
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-20"
                id={`${normalizedRoute}-rows-per-page`}
              >
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {rowsPerPageOptions.map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Strona {table.getState().pagination.pageIndex + 1} z{" "}
            {Math.max(table.getPageCount(), 1)}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <RiArrowLeftSLine />
            <span className="sr-only">Poprzednia strona</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <RiArrowRightSLine />
            <span className="sr-only">Następna strona</span>
          </Button>
        </div>
      </div>
      <RecordDetailSheet<Record<string, unknown>>
        api={api}
        mode="create"
        isOpen={isCreateSheetOpen}
        schemaRoute={normalizedRoute}
        baseRoute={normalizedCreateRouteBase ?? normalizedRoute}
        entityLabel="rekord"
        readOnlyFields={readOnlyFields}
        schemaOverride={schemaOverride}
        customFields={customFields}
        onClose={() => {
          if (normalizedCreateRouteBase) {
            navigateTo(normalizedCreateRouteBase, { replace: true })
            return
          }

          setIsCreateSheetOpenLocal(false)
        }}
        createRecord={
          createRecord ??
          ((payload) =>
            api.client.post<Record<string, unknown>, Record<string, unknown>>(
              normalizedRoute,
              payload
            ))
        }
        syncRelations={syncRelations}
        onCreated={() => {
          setPagination((current) => ({ ...current, pageIndex: 0 }))
          setDataRevision((current) => current + 1)
        }}
      />
    </div>
  )
}

import type {
  DataTableLoadRequest,
  DataTableLoadResponse,
} from "@/components/data-table"

type TableRecord = Record<string, unknown>

const compareValues = (left: unknown, right: unknown) => {
  if (left === right) {
    return 0
  }

  if (left === null || left === undefined) {
    return 1
  }

  if (right === null || right === undefined) {
    return -1
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right)
  }

  return String(left).localeCompare(String(right), "pl")
}

const matchesFilters = (
  record: TableRecord,
  filters: DataTableLoadRequest["filters"]
) => {
  if (!filters) {
    return true
  }

  return Object.entries(filters).every(([key, expectedValue]) => {
    if (expectedValue === undefined) {
      return true
    }

    return record[key] === expectedValue
  })
}

const matchesSearch = (record: TableRecord, search: string) => {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  return Object.values(record).some((value) => {
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      return false
    }

    return String(value).toLowerCase().includes(normalizedSearch)
  })
}

export const toClientTableResponse = <TRecord extends TableRecord>(
  records: TRecord[],
  request: DataTableLoadRequest
): DataTableLoadResponse<TRecord> => {
  const filteredRecords = records.filter(
    (record) =>
      matchesFilters(record, request.filters) &&
      matchesSearch(record, request.search)
  )
  const sortingEntry = request.sorting[0]
  const sortedRecords = sortingEntry
    ? [...filteredRecords].sort((left, right) => {
        const comparison = compareValues(
          left[sortingEntry.id],
          right[sortingEntry.id]
        )
        return sortingEntry.desc ? comparison * -1 : comparison
      })
    : filteredRecords

  const startIndex = request.pagination.pageIndex * request.pagination.pageSize
  const endIndex = startIndex + request.pagination.pageSize

  return {
    total: sortedRecords.length,
    records: sortedRecords.slice(startIndex, endIndex),
  }
}

import * as React from "react"
import { RiDeleteBinLine, RiEyeLine } from "@remixicon/react"
import { toast } from "sonner"

import { DataTable } from "@/components/data-table"
import type {
  DataTableLoadRequest,
  DataTableLoadResponse,
} from "@/components/data-table"
import type { DataTableRowAction } from "@/components/data-table-row-actions"
import { RecordDetailSheet } from "@/components/record-detail-sheet"
import type { CustomFormField } from "@/components/record-detail-sheet"
import { Card, CardContent } from "@/components/ui/card"
import { backendApi } from "@/lib/backend-api"
import type { ModelMeta } from "@/lib/backend-api"
import { navigateTo } from "@/lib/router"

type CrudPageRecord = Record<string, unknown> & {
  id: number
}

type CrudResourcePageProps<TRecord extends CrudPageRecord = CrudPageRecord> = {
  currentRoute: string
  baseRoute: string
  uiBaseRoute?: string
  schemaRoute: string
  entityLabel: string
  emptyMessage: string
  excludedColumns?: string[]
  readOnlyFields?: string[]
  detailTitleFields?: string[]
  deleteActionLabel?: string
  deleteErrorMessage?: string
  deleteSuccessMessage?: (record: TRecord) => string
  schemaOverride?: ModelMeta
  customFields?: CustomFormField[]
  loadData?: (
    request: DataTableLoadRequest
  ) => Promise<DataTableLoadResponse<TRecord>>
  loadRecord?: (id: number) => Promise<TRecord>
  updateRecord?: (
    id: number,
    payload: Record<string, unknown>
  ) => Promise<TRecord>
  createRecord?: (payload: Record<string, unknown>) => Promise<TRecord>
  syncRelations?: (
    recordId: number,
    relations: Record<string, unknown>
  ) => void | Promise<void>
  deleteRecord?: (record: TRecord) => Promise<void>
  rowActions?: DataTableRowAction<TRecord>[]
  disableUpdate?: boolean
}

const DEFAULT_EXCLUDED_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "is_deleted",
]

const getRecordIdFromRoute = (baseRoute: string, route: string) => {
  const routePrefix = `${baseRoute}/`

  if (!route.startsWith(routePrefix)) {
    return null
  }

  const recordId = Number(route.slice(routePrefix.length))
  return Number.isInteger(recordId) && recordId > 0 ? recordId : null
}

const getRecordTitle = <TRecord extends CrudPageRecord>(
  record: TRecord | null,
  recordId: number,
  entityLabel: string,
  detailTitleFields: string[]
) => {
  if (!record) {
    return `${entityLabel} #${recordId}`
  }

  const titleParts = detailTitleFields
    .map((fieldName) => record[fieldName])
    .filter(
      (value): value is string | number =>
        typeof value === "string" || typeof value === "number"
    )
    .map((value) => String(value).trim())
    .filter(Boolean)

  return titleParts.length > 0
    ? titleParts.join(" ")
    : `${entityLabel} #${recordId}`
}

export default function CrudResourcePage<
  TRecord extends CrudPageRecord = CrudPageRecord,
>({
  currentRoute,
  baseRoute,
  uiBaseRoute,
  schemaRoute,
  entityLabel,
  emptyMessage,
  excludedColumns = DEFAULT_EXCLUDED_COLUMNS,
  readOnlyFields = excludedColumns,
  detailTitleFields = [],
  deleteActionLabel = "Delete",
  deleteErrorMessage = "Unable to delete the record.",
  deleteSuccessMessage,
  schemaOverride,
  customFields,
  loadData,
  loadRecord,
  updateRecord,
  createRecord,
  syncRelations,
  deleteRecord,
  rowActions = [],
  disableUpdate = false,
}: CrudResourcePageProps<TRecord>) {
  const resolvedBaseRoute = uiBaseRoute ?? baseRoute
  const selectedRecordId = getRecordIdFromRoute(resolvedBaseRoute, currentRoute)
  const [reloadKey, setReloadKey] = React.useState(0)

  const deleteRecordByRecord = React.useCallback(
    async (record: TRecord) => {
      if (deleteRecord) {
        await deleteRecord(record)
        return
      }

      await backendApi.deleteByRoute(schemaRoute, record.id)
    },
    [deleteRecord, schemaRoute]
  )

  const handleDelete = React.useCallback(
    async (record: TRecord | null) => {
      if (!record) {
        toast.error("Unable to identify the record to delete.")
        return
      }

      try {
        await deleteRecordByRecord(record)
        toast.success(
          deleteSuccessMessage?.(record) ??
            `${entityLabel} #${record.id} deleted.`
        )
        setReloadKey((current) => current + 1)
        navigateTo(resolvedBaseRoute, { replace: true })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : deleteErrorMessage)
      }
    },
    [
      deleteRecordByRecord,
      deleteErrorMessage,
      deleteSuccessMessage,
      entityLabel,
      resolvedBaseRoute,
    ]
  )

  const resolvedRowActions = React.useMemo<
    DataTableRowAction<TRecord>[]
  >(() => {
    return [
      {
        label: "Open details",
        icon: RiEyeLine,
        onSelect: (record) => navigateTo(`${resolvedBaseRoute}/${record.id}`),
      },
      ...rowActions,
      {
        label: deleteActionLabel,
        icon: RiDeleteBinLine,
        variant: "destructive",
        onSelect: (record) => void handleDelete(record),
      },
    ]
  }, [deleteActionLabel, handleDelete, resolvedBaseRoute, rowActions])

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent>
            <DataTable<TRecord>
              api={backendApi}
              schemaRoute={schemaRoute}
              reloadKey={reloadKey}
              currentRoute={currentRoute}
              createRouteBase={resolvedBaseRoute}
              excludedColumns={excludedColumns}
              readOnlyFields={readOnlyFields}
              withRowSelection
              getRowId={(row) => row.id.toString()}
              emptyMessage={emptyMessage}
              rowActions={resolvedRowActions}
              schemaOverride={schemaOverride}
              customFields={customFields}
              loadData={loadData}
              createRecord={createRecord}
              bulkDeleteRecords={(records) =>
                Promise.all(records.map(deleteRecordByRecord)).then(
                  () => undefined
                )
              }
              syncRelations={syncRelations}
            />
          </CardContent>
        </Card>
      </div>
      <RecordDetailSheet<TRecord>
        api={backendApi}
        schemaRoute={schemaRoute}
        baseRoute={resolvedBaseRoute}
        recordId={selectedRecordId}
        entityLabel={entityLabel}
        readOnlyFields={readOnlyFields}
        schemaOverride={schemaOverride}
        customFields={customFields}
        onClose={() => navigateTo(resolvedBaseRoute, { replace: true })}
        loadRecord={
          loadRecord ??
          ((recordId) =>
            backendApi.client.get<TRecord>(`${schemaRoute}/${recordId}`))
        }
        updateRecord={
          disableUpdate
            ? undefined
            : (updateRecord ??
              ((recordId, payload) =>
                backendApi.client.put<TRecord, Record<string, unknown>>(
                  `${schemaRoute}/${recordId}`,
                  payload
                )))
        }
        createRecord={createRecord}
        syncRelations={syncRelations}
        onArchive={handleDelete}
        getRecordTitle={(record, recordId) =>
          getRecordTitle(record, recordId, entityLabel, detailTitleFields)
        }
      />
    </div>
  )
}

import * as React from "react"
import { RiUserStarLine } from "@remixicon/react"

import type {
  DataTableLoadRequest,
  DataTableLoadResponse,
} from "@/components/data-table"
import { backendApi } from "@/lib/backend-api"
import type { BackendQuery, ModelMeta, SchemaField } from "@/lib/backend-api"
import { navigateTo } from "@/lib/router"
import CrudResourcePage from "@/pages/crud-resource-page"

type TrainingSessionPageProps = {
  currentRoute: string
}

type NamedRelation = {
  name?: unknown
}

type TrainingSessionSchedule = {
  id: number
  training_form_id?: number | null
  season_id?: number | null
  training_form?: NamedRelation | null
  seasons?: NamedRelation | null
}

type TrainingSessionRecord = {
  id: number
  schedule_id?: number | null
  schedule?: TrainingSessionSchedule | null
  training_form_name?: string | null
  season_name?: string | null
}

const TRAINING_SESSION_SCHEMA_ROUTE = "/training/sessions"
const SCHEDULE_SCHEMA_ROUTE = "/training/schedule"
const DERIVED_FIELD_NAMES = ["training_form_name", "season_name"]
const TRAINING_SESSION_EXCLUDED_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "deleted_at",
  "is_deleted",
]
const TRAINING_SESSION_READ_ONLY_FIELDS = [
  ...TRAINING_SESSION_EXCLUDED_COLUMNS,
  ...DERIVED_FIELD_NAMES,
]

const createDerivedField = (
  name: string,
  transcription: string,
  description: string
): SchemaField => ({
  name,
  transcription,
  description,
  data_type: "str",
  value_type: "string",
  ui_type: "text",
  input_mode: "derived",
  semantic: null,
  nullable: true,
  primary_key: false,
  default: null,
  foreign_keys: [],
  allowed_values: null,
  rules: null,
  derive: { source: "schedule" },
})

const DERIVED_SCHEMA_FIELDS: SchemaField[] = [
  createDerivedField(
    "training_form_name",
    "Forma treningowa",
    "Training form name from the schedule linked to the session."
  ),
  createDerivedField(
    "season_name",
    "Sezon",
    "Season name from the schedule linked to the session."
  ),
]

const extractRecords = <TRecord,>(payload: unknown): TRecord[] => {
  if (typeof payload !== "object" || payload === null) {
    return []
  }

  if (Array.isArray((payload as { records?: unknown }).records)) {
    return (payload as { records: TRecord[] }).records
  }

  const firstArrayValue = Object.entries(payload).find(
    ([key, value]) => key !== "total" && Array.isArray(value)
  )?.[1]

  return Array.isArray(firstArrayValue) ? (firstArrayValue as TRecord[]) : []
}

const extractTotal = (payload: unknown, fallback: number) => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { total?: unknown }).total === "number"
  ) {
    return (payload as { total: number }).total
  }

  return fallback
}

const toNullableString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null

const getRelationName = (relation: NamedRelation | null | undefined) =>
  toNullableString(relation?.name)

const enrichTrainingSessionRecord = (
  record: TrainingSessionRecord,
  schedulesById: Map<number, TrainingSessionSchedule>
): TrainingSessionRecord => {
  const scheduleId =
    typeof record.schedule_id === "number" ? record.schedule_id : null
  const schedule =
    (scheduleId !== null ? schedulesById.get(scheduleId) : undefined) ??
    record.schedule ??
    null

  return {
    ...record,
    schedule,
    training_form_name:
      getRelationName(schedule?.training_form) ??
      (typeof schedule?.training_form_id === "number"
        ? `#${schedule.training_form_id}`
        : null),
    season_name:
      getRelationName(schedule?.seasons) ??
      (typeof schedule?.season_id === "number"
        ? `#${schedule.season_id}`
        : null),
  }
}

const buildTrainingSessionSchema = (schema: ModelMeta): ModelMeta => {
  const derivedFieldNames = new Set(DERIVED_FIELD_NAMES)
  const fieldsWithoutDerived = schema.fields.filter(
    (field) => !derivedFieldNames.has(field.name)
  )
  const sessionDateIndex = fieldsWithoutDerived.findIndex(
    (field) => field.name === "session_date"
  )
  const insertIndex =
    sessionDateIndex === -1 ? fieldsWithoutDerived.length : sessionDateIndex + 1

  return {
    ...schema,
    fields: [
      ...fieldsWithoutDerived.slice(0, insertIndex),
      ...DERIVED_SCHEMA_FIELDS,
      ...fieldsWithoutDerived.slice(insertIndex),
    ],
  }
}

const buildListQuery = (request: DataTableLoadRequest): BackendQuery => {
  const sortingEntry = request.sorting[0]

  return {
    ...request.query,
    filters: request.filters ? JSON.stringify(request.filters) : undefined,
    search: request.search || undefined,
    skip: request.pagination.pageIndex * request.pagination.pageSize,
    limit: request.pagination.pageSize,
    order_by_col: DERIVED_FIELD_NAMES.includes(sortingEntry?.id ?? "")
      ? undefined
      : sortingEntry?.id,
    order_by_asc:
      sortingEntry?.desc === undefined
        ? undefined
        : sortingEntry.desc
          ? "desc"
          : "asc",
  }
}

const loadSchedules = async (signal?: AbortSignal) => {
  const response = await backendApi.client.get<unknown>(SCHEDULE_SCHEMA_ROUTE, {
    query: {
      limit: 1000,
    },
    signal,
  })

  return new Map(
    extractRecords<TrainingSessionSchedule>(response).map((schedule) => [
      schedule.id,
      schedule,
    ])
  )
}

const loadTrainingSessionData = async (
  request: DataTableLoadRequest
): Promise<DataTableLoadResponse<TrainingSessionRecord>> => {
  const [sessionResponse, schedulesById] = await Promise.all([
    backendApi.client.get<unknown>(
      TRAINING_SESSION_SCHEMA_ROUTE,
      {
        query: buildListQuery(request),
        signal: request.signal,
      }
    ),
    loadSchedules(request.signal),
  ])
  const sessionRecords = extractRecords<TrainingSessionRecord>(sessionResponse)

  return {
    total: extractTotal(sessionResponse, sessionRecords.length),
    records: sessionRecords.map((record) =>
      enrichTrainingSessionRecord(record, schedulesById)
    ),
  }
}

const loadTrainingSessionRecord = async (
  id: number
): Promise<TrainingSessionRecord> => {
  const record = await backendApi.client.get<TrainingSessionRecord>(
    `${TRAINING_SESSION_SCHEMA_ROUTE}/${id}`
  )
  const schedulesById = new Map<number, TrainingSessionSchedule>()

  if (typeof record.schedule_id === "number") {
    try {
      const schedule = await backendApi.client.get<TrainingSessionSchedule>(
        `${SCHEDULE_SCHEMA_ROUTE}/${record.schedule_id}`
      )
      schedulesById.set(schedule.id, schedule)
    } catch {
      if (record.schedule) {
        schedulesById.set(record.schedule.id, record.schedule)
      }
    }
  }

  return enrichTrainingSessionRecord(record, schedulesById)
}

export default function TrainingSessionPage({
  currentRoute,
}: TrainingSessionPageProps) {
  const [schemaOverride, setSchemaOverride] = React.useState<
    ModelMeta | undefined
  >()

  React.useEffect(() => {
    let isCancelled = false

    const loadSchema = async () => {
      try {
        const schema = await backendApi.getSchema(TRAINING_SESSION_SCHEMA_ROUTE)
        if (!isCancelled) {
          setSchemaOverride(buildTrainingSessionSchema(schema))
        }
      } catch {
        if (!isCancelled) {
          setSchemaOverride(undefined)
        }
      }
    }

    void loadSchema()

    return () => {
      isCancelled = true
    }
  }, [])

  return (
    <CrudResourcePage<TrainingSessionRecord>
      currentRoute={currentRoute}
      baseRoute="/training-session"
      schemaRoute={TRAINING_SESSION_SCHEMA_ROUTE}
      entityLabel="Training session"
      emptyMessage="No training sessions to display."
      excludedColumns={TRAINING_SESSION_EXCLUDED_COLUMNS}
      readOnlyFields={TRAINING_SESSION_READ_ONLY_FIELDS}
      detailTitleFields={["session_date"]}
      schemaOverride={schemaOverride}
      loadData={loadTrainingSessionData}
      loadRecord={loadTrainingSessionRecord}
      rowActions={[
        {
          label: "Attendance roster",
          icon: RiUserStarLine,
          onSelect: (record) =>
            navigateTo(`/training-session-sheet/${record.id}`),
        },
      ]}
      deleteSuccessMessage={(record) =>
        `Deleted training session #${record.id}.`
      }
    />
  )
}

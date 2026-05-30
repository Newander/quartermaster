import type { DataTableLoadRequest } from "@/components/data-table"
import { backendApi } from "@/lib/backend-api"
import type { ModelMeta } from "@/lib/backend-api"
import { toClientTableResponse } from "@/lib/client-table"
import CrudResourcePage from "@/pages/crud-resource-page"

type AttendanceRecord = {
  id: number
  session_id: number
  member_id: number
  attended: boolean
  notes?: string | null
  created_at: string
  member?: Record<string, unknown>
}

const ATTENDANCE_SCHEMA: ModelMeta = {
  name: "training_session_attendance",
  fields: [
    {
      name: "id",
      transcription: "ID",
      description: "Id",
      data_type: "int",
      nullable: false,
      primary_key: true,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "session_id",
      transcription: "Sesja",
      description: "Session ID",
      data_type: "int",
      nullable: false,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "member_id",
      transcription: "Członek",
      description: "Member ID",
      data_type: "int",
      nullable: false,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "attended",
      transcription: "Obecność",
      description: "Attended",
      data_type: "bool",
      nullable: false,
      primary_key: false,
      default: true,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "notes",
      transcription: "Notatki",
      description: "Notes",
      data_type: "str",
      nullable: true,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "created_at",
      transcription: "Utworzono",
      description: "Created at",
      data_type: "datetime",
      nullable: false,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
  ],
  filters: [
    ["session_id", "Sesja ID", "int"],
    ["member_id", "Członek ID", "int"],
    ["attended", "Obecność", "bool"],
  ],
  relation_lookups: {},
}

const loadAttendance = async (request: DataTableLoadRequest) => {
  const records = await backendApi.client.get<{
    total: number
    records: AttendanceRecord[]
  }>("/training/attendance", {
    query: {
      skip: 0,
      limit: 1000,
      filters: request.filters ? JSON.stringify(request.filters) : undefined,
    },
    signal: request.signal,
  })

  return toClientTableResponse(records.records, request)
}

type TrainingSessionAttendancePageProps = {
  currentRoute: string
}

export default function TrainingSessionAttendancePage({
  currentRoute,
}: TrainingSessionAttendancePageProps) {
  return (
    <CrudResourcePage<AttendanceRecord>
      currentRoute={currentRoute}
      baseRoute="/training-session-attendance"
      schemaRoute="/training/attendance"
      entityLabel="Obecność"
      emptyMessage="Brak wpisów obecności do wyświetlenia."
      detailTitleFields={["session_id", "member_id"]}
      excludedColumns={["id", "created_at"]}
      schemaOverride={ATTENDANCE_SCHEMA}
      loadData={loadAttendance}
      createRecord={(payload) =>
        backendApi.client.post<AttendanceRecord, Record<string, unknown>>(
          "/training/attendance",
          payload
        )
      }
      deleteRecord={(record) =>
        backendApi.client.delete(`/training/attendance/${record.id}`)
      }
      deleteSuccessMessage={(record) =>
        `Usunięto wpis obecności #${record.id}.`
      }
    />
  )
}


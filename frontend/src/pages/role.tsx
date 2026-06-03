import CrudResourcePage from "@/pages/crud-resource-page"
import { backendApi } from "@/lib/backend-api"
import type { ModelMeta } from "@/lib/backend-api"
import type { DataTableLoadRequest } from "@/components/data-table"
import { toClientTableResponse } from "@/lib/client-table"

type RoleRecord = {
  id: number
  name: string
  description?: string | null
  permissions?: Array<Record<string, unknown>>
}

const ROLE_SCHEMA: ModelMeta = {
  name: "role",
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
      name: "name",
      transcription: "Name",
      description: "Name",
      data_type: "str",
      nullable: false,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
    {
      name: "description",
      transcription: "Description",
      description: "Description",
      data_type: "str",
      nullable: true,
      primary_key: false,
      default: null,
      foreign_keys: [],
      allowed_values: null,
    },
  ],
  filters: [],
  relation_lookups: {},
}

const loadRoles = async (request: DataTableLoadRequest) => {
  const records = await backendApi.client.get<RoleRecord[]>("/auth/roles", {
    signal: request.signal,
  })

  return toClientTableResponse(records, request)
}

type RolePageProps = {
  currentRoute: string
}

export default function RolePage({ currentRoute }: RolePageProps) {
  return (
    <CrudResourcePage<RoleRecord>
      currentRoute={currentRoute}
      baseRoute="/role"
      schemaRoute="/auth/roles"
      entityLabel="Role"
      emptyMessage="No roles to display."
      detailTitleFields={["name"]}
      excludedColumns={["id"]}
      schemaOverride={ROLE_SCHEMA}
      loadData={loadRoles}
      createRecord={(payload) =>
        backendApi.client.post<RoleRecord, Record<string, unknown>>(
          "/auth/roles",
          payload
        )
      }
      deleteRecord={(record) =>
        backendApi.client.delete(`/auth/roles/${record.id}`)
      }
      deleteSuccessMessage={(record) => `Deleted role "${record.name}".`}
      disableUpdate
    />
  )
}


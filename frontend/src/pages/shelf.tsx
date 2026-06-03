import type { DataTableLoadRequest } from "@/components/data-table"
import { backendApi } from "@/lib/backend-api"
import type { ModelMeta, SchemaField } from "@/lib/backend-api"
import { toClientTableResponse } from "@/lib/client-table"
import CrudResourcePage from "@/pages/crud-resource-page"

type ShelfStatus = "available" | "occupied" | "maintenance" | "reserved"

type ShelfRecord = {
  id: number
  shelf_number: string
  rack_id: number
  size?: string | null
  description?: string | null
  is_deleted?: boolean | null
  status: ShelfStatus
}

type RackRecord = {
  id: number
  name: string
  owner?: string | null
  is_deleted?: boolean | null
}

type ShelfPlanRecord = {
  id: number
  name: string
  description?: string | null
  price: number
  duration_days: number
  is_deleted?: boolean | null
}

type ShelfRentalRecord = {
  id: number
  shelf_id: number
  member_id: number
  plan_id: number
  payment_id?: number | null
  contract_id?: number | null
  start_date: string
  end_date: string
  is_active: boolean
  notes?: string | null
}

const schemaField = (
  name: string,
  transcription: string,
  dataType: string,
  options: Partial<SchemaField> = {}
): SchemaField => ({
  name,
  transcription,
  description: options.description ?? transcription,
  data_type: dataType,
  nullable: options.nullable ?? false,
  primary_key: options.primary_key ?? false,
  default: options.default ?? null,
  foreign_keys: options.foreign_keys ?? [],
  allowed_values: options.allowed_values ?? null,
  ui_type: options.ui_type,
  display: options.display ?? null,
})

const SHELF_SCHEMA: ModelMeta = {
  name: "shelf",
  fields: [
    schemaField("id", "ID", "int", {
      description: "Shelf identifier",
      primary_key: true,
    }),
    schemaField("shelf_number", "Shelf number", "str", {
      description: "Unique shelf number",
    }),
    schemaField("rack_id", "Stojak", "int", {
      description: "Rack that contains the shelf",
      foreign_keys: [
        {
          target_table: "rack",
          target_field: "id",
          target_fullname: "rack.id",
        },
      ],
    }),
    schemaField("size", "Rozmiar", "str", {
      description: "Shelf size",
      nullable: true,
    }),
    schemaField("description", "Description", "str", {
      description: "Additional shelf description",
      nullable: true,
      ui_type: "textarea",
    }),
    schemaField("is_deleted", "Deleted", "bool", {
      description: "Whether the shelf is marked as deleted",
      nullable: true,
      default: false,
    }),
    schemaField("status", "Status", "ShelfStatus", {
      description: "Current shelf status",
      default: "available",
      allowed_values: ["available", "occupied", "maintenance", "reserved"],
    }),
  ],
  filters: [["status_filter", "Status", "ShelfStatus"]],
  relation_lookups: {
    rack_id: {
      api_route: "/shelves/racks",
      value_field: "id",
      label_field: "name",
      description: "Select the rack that contains the shelf.",
      app_route: "/shelf/racks",
      relation_kind: "one",
      foreign_key: "rack_id",
      foreign_table: "rack",
    },
  },
}

const SHELF_PLAN_SCHEMA: ModelMeta = {
  name: "shelf_plan",
  fields: [
    schemaField("id", "ID", "int", {
      description: "Identyfikator planu",
      primary_key: true,
    }),
    schemaField("name", "Name", "str"),
    schemaField("description", "Description", "str", {
      nullable: true,
      ui_type: "textarea",
      display: {
        table: {
          max_width: "18rem",
          truncate: true,
          tooltip: true,
        },
      },
    }),
    schemaField("price", "Cena", "float"),
    schemaField("duration_days", "Czas trwania", "int", {
      description: "Czas trwania w dniach",
    }),
    schemaField("is_deleted", "Deleted", "bool", {
      nullable: true,
      default: false,
    }),
  ],
  filters: [],
  relation_lookups: {},
}

const SHELF_RENTAL_SCHEMA: ModelMeta = {
  name: "shelf_rental",
  fields: [
    schemaField("id", "ID", "int", {
      description: "Identyfikator wynajmu",
      primary_key: true,
    }),
    schemaField("shelf_id", "Shelf", "int", {
      description: "Shelf assigned to the rental",
    }),
    schemaField("member_id", "Member", "int", {
      description: "Member assigned to the rental",
    }),
    schemaField("plan_id", "Plan", "int", {
      description: "Shelf rental plan",
    }),
    schemaField("contract_id", "Dokument", "int", {
      description: "Document linked to the rental",
      nullable: true,
    }),
    schemaField("payment_id", "Payment", "int", {
      description: "Payment generated for the rental",
      nullable: true,
    }),
    schemaField("start_date", "Data startu", "date"),
    schemaField("end_date", "End date", "date", {
      description: "Calculated rental end date",
    }),
    schemaField("is_active", "Aktywny", "bool", {
      description: "Czy wynajem jest obecnie aktywny",
      default: false,
    }),
    schemaField("notes", "Notatki", "str", {
      nullable: true,
      ui_type: "textarea",
    }),
    schemaField("payment_amount", "Payment amount", "float", {
      description: "Amount used when creating the rental",
    }),
    schemaField("payment_method", "Payment method", "PaymentMethod", {
      description: "Payment method used when creating the rental",
      default: "transfer",
      allowed_values: ["transfer", "cash", "card", "blik", "barter"],
    }),
  ],
  filters: [
    ["member_id", "Member", "int"],
    ["shelf_id", "Shelf", "int"],
  ],
  relation_lookups: {
    shelf_id: {
      api_route: "/shelves/shelves",
      value_field: "id",
      label_field: "shelf_number",
      description: "Select the shelf assigned to the rental.",
      app_route: "/shelf/shelves",
      relation_kind: "one",
      foreign_key: "shelf_id",
      foreign_table: "shelf",
    },
    member_id: {
      api_route: "/member",
      value_field: "id",
      label_field: "email",
      description: "Select the member assigned to the rental.",
      app_route: "/member",
      relation_kind: "one",
      foreign_key: "member_id",
      foreign_table: "member",
    },
    plan_id: {
      api_route: "/shelves/plans",
      value_field: "id",
      label_field: "name",
      description: "Select the rental plan.",
      relation_kind: "one",
      foreign_key: "plan_id",
      foreign_table: "shelf_plan",
    },
    contract_id: {
      api_route: "/contract",
      value_field: "id",
      label_field: "title",
      description: "Select the document linked to the rental.",
      app_route: "/contract",
      relation_kind: "one",
      foreign_key: "contract_id",
      foreign_table: "contract",
    },
    payment_id: {
      api_route: "/membership/payments",
      value_field: "id",
      label_field: "description",
      description: "Payment linked to the rental.",
      relation_kind: "one",
      foreign_key: "payment_id",
      foreign_table: "payment",
    },
  },
}

const cleanPayload = (payload: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )

const loadShelves = async (request: DataTableLoadRequest) => {
  const sortingEntry = request.sorting[0]
  const response = await backendApi.client.get<{
    total: number
    shelves: ShelfRecord[]
  }>("/shelves/shelves", {
    query: {
      skip: request.pagination.pageIndex * request.pagination.pageSize,
      limit: request.pagination.pageSize,
      order_by_col: sortingEntry?.id,
      order_by_asc:
        sortingEntry?.desc === undefined
          ? undefined
          : sortingEntry.desc
            ? "desc"
            : "asc",
      status_filter: request.filters?.status_filter as ShelfStatus | undefined,
      search: request.search || undefined,
    },
    signal: request.signal,
  })

  return {
    total: response.total,
    records: response.shelves,
  }
}

const loadShelfPlans = async (request: DataTableLoadRequest) => {
  const records = await backendApi.client.get<ShelfPlanRecord[]>(
    "/shelves/plans",
    {
      query: {
        skip: 0,
        limit: 1000,
      },
      signal: request.signal,
    }
  )

  return toClientTableResponse(records, request)
}

const loadShelfRentals = async (request: DataTableLoadRequest) => {
  const response = await backendApi.client.get<{
    total: number
    rentals: ShelfRentalRecord[]
  }>("/shelves/rentals", {
    query: {
      skip: request.pagination.pageIndex * request.pagination.pageSize,
      limit: request.pagination.pageSize,
      member_id: request.filters?.member_id as number | undefined,
      shelf_id: request.filters?.shelf_id as number | undefined,
      search: request.search || undefined,
    },
    signal: request.signal,
  })

  return {
    total: response.total,
    records: response.rentals,
  }
}

const getShelfSection = (route: string) => {
  if (route.startsWith("/shelf/racks")) {
    return "racks"
  }

  if (route.startsWith("/shelf/rentals")) {
    return "rentals"
  }

  if (route.startsWith("/shelf/plans")) {
    return "plans"
  }

  return "shelves"
}

type ShelfPageProps = {
  currentRoute: string
}

export default function ShelfPage({ currentRoute }: ShelfPageProps) {
  const activeSection = getShelfSection(currentRoute)

  if (activeSection === "racks") {
    return (
      <CrudResourcePage<RackRecord>
        currentRoute={currentRoute}
        baseRoute="/shelf/racks"
        schemaRoute="/shelves/racks"
        entityLabel="Rack"
        emptyMessage="No racks to display."
        detailTitleFields={["name", "owner"]}
        excludedColumns={["id", "created_at", "updated_at", "is_deleted"]}
        deleteSuccessMessage={(record) => `Deleted rack "${record.name}".`}
      />
    )
  }

  if (activeSection === "rentals") {
    return (
      <CrudResourcePage<ShelfRentalRecord>
        currentRoute={currentRoute}
        baseRoute="/shelf/rentals"
        schemaRoute="/shelves/rentals"
        entityLabel="Shelf rental"
        emptyMessage="No shelf rentals to display."
        detailTitleFields={["shelf_id", "member_id"]}
        excludedColumns={[
          "id",
          "payment_id",
          "shelf",
          "plan",
          "payment",
          "contract",
        ]}
        schemaOverride={SHELF_RENTAL_SCHEMA}
        loadData={loadShelfRentals}
        createRecord={(payload) =>
          backendApi.client.post<ShelfRentalRecord, Record<string, unknown>>(
            "/shelves/rentals",
            cleanPayload(payload)
          )
        }
        updateRecord={(recordId, payload) =>
          backendApi.client.patch<ShelfRentalRecord, Record<string, unknown>>(
            `/shelves/rentals/${recordId}`,
            cleanPayload(payload)
          )
        }
        deleteRecord={(record) =>
          backendApi.client.delete(`/shelves/rentals/${record.id}`)
        }
        deleteSuccessMessage={(record) =>
          `Deleted shelf rental #${record.id}.`
        }
      />
    )
  }

  if (activeSection === "plans") {
    return (
      <CrudResourcePage<ShelfPlanRecord>
        currentRoute={currentRoute}
        baseRoute="/shelf/plans"
        schemaRoute="/shelves/plans"
        entityLabel="Rental plan"
        emptyMessage="No rental plans to display."
        detailTitleFields={["name", "price"]}
        excludedColumns={["id", "is_deleted"]}
        schemaOverride={SHELF_PLAN_SCHEMA}
        loadData={loadShelfPlans}
        createRecord={(payload) =>
          backendApi.client.post<ShelfPlanRecord, Record<string, unknown>>(
            "/shelves/plans",
            cleanPayload(payload)
          )
        }
        updateRecord={(recordId, payload) =>
          backendApi.client.patch<ShelfPlanRecord, Record<string, unknown>>(
            `/shelves/plans/${recordId}`,
            cleanPayload(payload)
          )
        }
        deleteRecord={(record) =>
          backendApi.client.delete(`/shelves/plans/${record.id}`)
        }
        deleteSuccessMessage={(record) => `Deleted plan "${record.name}".`}
      />
    )
  }

  return (
    <CrudResourcePage<ShelfRecord>
      currentRoute={currentRoute}
      baseRoute="/shelf/shelves"
      schemaRoute="/shelves/shelves"
      entityLabel="Shelf"
      emptyMessage="No shelves to display."
      detailTitleFields={["shelf_number", "rack_id"]}
      excludedColumns={["id", "is_deleted", "status"]}
      schemaOverride={SHELF_SCHEMA}
      loadData={loadShelves}
      createRecord={(payload) =>
        backendApi.client.post<ShelfRecord, Record<string, unknown>>(
          "/shelves/shelves",
          cleanPayload(payload)
        )
      }
      updateRecord={(recordId, payload) =>
        backendApi.client.patch<ShelfRecord, Record<string, unknown>>(
          `/shelves/shelves/${recordId}`,
          cleanPayload(payload)
        )
      }
      deleteRecord={(record) =>
        backendApi.client.delete(`/shelves/shelves/${record.id}`)
      }
      deleteSuccessMessage={(record) =>
        `Deleted shelf "${record.shelf_number}".`
      }
    />
  )
}

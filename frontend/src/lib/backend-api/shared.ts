import { api as defaultApi } from "@/lib/api-client"
import type { ApiClient, QueryParamValue, QueryParams } from "@/lib/api-client"
import type { components } from "@/types/api.generated"

export type BackendQuery = Record<string, QueryParamValue>
export type SchemaFieldType = string
export type RelationLookup = {
  api_route: string
  value_field: string
  source_value_field?: string | null
  label_field: string
  transcription?: string | null
  description?: string | null
  app_route?: string | null
  relation_kind?: "one" | "many"
  foreign_key?: string | null
  foreign_table?: string | null
}
export type RelationLookups = Record<string, RelationLookup>
export type SchemaField = Omit<
  components["schemas"]["ColumnMetaOut"],
  "name" | "type" | "data_type" | "allowed_values"
> & {
  name: string
  transcription: string
  data_type: SchemaFieldType
  value_type?: string | null
  ui_type?: string | null
  input_mode?: string | null
  semantic?: string | null
  description?: string
  allowed_values?: Array<string | number> | null
  rules?: Record<string, unknown> | null
  derive?: Record<string, unknown> | null
  display?: Record<string, unknown> | null
}
export type SchemaFilter = [name: string, label: string, type: SchemaFieldType]
export type ModelMeta = Omit<
  components["schemas"]["ModelMetaOut"],
  "name" | "fields" | "filters" | "relation_lookups"
> & {
  name: string
  fields: SchemaField[]
  filters?: SchemaFilter[]
  relation_lookups?: RelationLookups
}

const isDefinedQueryValue = (value: QueryParamValue) =>
  value !== null && value !== undefined

export function mergeQueryParams(
  ...parts: Array<BackendQuery | null | undefined>
): QueryParams {
  const query: QueryParams = {}

  for (const part of parts) {
    if (!part) {
      continue
    }

    for (const [key, value] of Object.entries(part)) {
      if (!isDefinedQueryValue(value)) {
        continue
      }

      query[key] = value
    }
  }

  return query
}

type ListOptions<TQuery extends BackendQuery, TFilter extends BackendQuery> = {
  query?: TQuery
  filters?: TFilter | null
}

export class CrudResourceApi<
  TRecord,
  TCreateInput,
  TUpdateInput,
  TListResponse,
  TListQuery extends BackendQuery,
  TFilter extends BackendQuery,
> {
  protected readonly client: ApiClient
  readonly route: string

  constructor(client: ApiClient, route: string) {
    this.client = client
    this.route = route
  }

  getSchema() {
    return this.client.get<ModelMeta>(`${this.route}/schema`)
  }

  getById(id: number) {
    return this.client.get<TRecord>(`${this.route}/${id}`)
  }

  list(options: ListOptions<TListQuery, TFilter> = {}) {
    return this.client.get<TListResponse>(this.route, {
      // The generated schema models filters as a GET body. In the browser client
      // we send the same scalar fields as query params to keep requests standards-compliant.
      query: mergeQueryParams(options.query, options.filters),
    })
  }

  create(payload: TCreateInput) {
    return this.client.post<TRecord, TCreateInput>(this.route, payload)
  }

  update(id: number, payload: TUpdateInput) {
    return this.client.put<TRecord, TUpdateInput>(
      `${this.route}/${id}`,
      payload
    )
  }

  delete(id: number) {
    return this.client.delete<Record<string, unknown>>(`${this.route}/${id}`)
  }
}

export class BackendApi {
  readonly client: ApiClient

  constructor(client: ApiClient = defaultApi) {
    this.client = client
  }

  deleteByRoute(route: string, id: number) {
    const normalizedRoute = route.endsWith("/") ? route.slice(0, -1) : route
    return this.client.delete<Record<string, unknown>>(
      `${normalizedRoute}/${id}`
    )
  }

  getSchema(route: string) {
    const normalizedRoute = route.endsWith("/") ? route.slice(0, -1) : route
    return this.client.get<ModelMeta>(`${normalizedRoute}/schema`)
  }
}

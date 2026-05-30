import type { components, operations } from "@/types/api.generated"

import { BackendApi, CrudResourceApi } from "./shared"

type MemberListOperation = operations["wrapped_list_route_api_member_get"]
type MemberExportOperation =
  operations["wrapped_export_route_api_member_export_post"]

export type Member = components["schemas"]["app__database__MemberModel__3"]
export type MemberCreateInput =
  components["schemas"]["app__database__MemberModel__1"]
export type MemberUpdateInput =
  components["schemas"]["app__database__MemberModel__2"]
export type MemberListResponse =
  components["schemas"]["ListResponse_MemberModel_"]
export type MemberFilter =
  components["schemas"]["app__common__route_generator__MemberFilter"]
export type MemberExportFilter =
  components["schemas"]["app__common__route_generator__MemberFilter__2"]
export type MemberListQuery = NonNullable<
  MemberListOperation["parameters"]["query"]
>
export type MemberExportQuery = NonNullable<
  MemberExportOperation["parameters"]["query"]
>

export type ExportMembersOptions = {
  query?: MemberExportQuery
  filters?: MemberExportFilter | null
}

export class MemberApi extends CrudResourceApi<
  Member,
  MemberCreateInput,
  MemberUpdateInput,
  MemberListResponse,
  MemberListQuery,
  MemberFilter
> {
  constructor(api: BackendApi) {
    super(api.client, "/member")
  }

  export(options: ExportMembersOptions = {}) {
    return this.client.post<Blob, MemberExportFilter | null>(
      `${this.route}/export`,
      options.filters ?? null,
      {
        query: options.query,
        responseType: "blob",
      }
    )
  }
}

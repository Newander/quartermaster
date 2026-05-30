import type { ApiClient } from "@/lib/api-client"

import { InstructorApi } from "./instructor"
import { MemberApi } from "./member"
import { BackendApi as BaseBackendApi } from "./shared"

export * from "./instructor"
export * from "./member"
export * from "./shared"

export class BackendApi extends BaseBackendApi {
  readonly member: MemberApi
  readonly instructor: InstructorApi

  constructor(client?: ApiClient) {
    super(client)
    this.member = new MemberApi(this)
    this.instructor = new InstructorApi(this)
  }
}

export const backendApi = new BackendApi()

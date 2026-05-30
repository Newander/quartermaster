import type { components, operations } from "@/types/api.generated"

import { BackendApi, CrudResourceApi } from "./shared"

type InstructorListOperation =
  operations["wrapped_list_route_api_instructor_get"]

export type Instructor =
  components["schemas"]["app__database__InstructorModel__4"]
export type InstructorCreateInput =
  components["schemas"]["app__database__InstructorModel"]
export type InstructorUpdateInput =
  components["schemas"]["app__database__InstructorModel__2"]
export type InstructorListResponse =
  components["schemas"]["ListResponse_InstructorModel_"]
export type InstructorFilter = components["schemas"]["InstructorFilter"]
export type InstructorListQuery = NonNullable<
  InstructorListOperation["parameters"]["query"]
>

export class InstructorApi extends CrudResourceApi<
  Instructor,
  InstructorCreateInput,
  InstructorUpdateInput,
  InstructorListResponse,
  InstructorListQuery,
  InstructorFilter
> {
  constructor(api: BackendApi) {
    super(api.client, "/instructor")
  }
}

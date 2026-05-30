import { backendApi } from "@/lib/backend-api"

const toInstructorIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (typeof entry === "number") {
        return entry
      }

      if (typeof entry === "string") {
        const parsed = Number(entry)
        return Number.isInteger(parsed) ? parsed : null
      }

      return null
    })
    .filter((entry): entry is number => entry !== null)
}

export const syncScheduleRelations = async (
  scheduleId: number,
  relations: Record<string, unknown>
) => {
  if (!Object.prototype.hasOwnProperty.call(relations, "instructors")) {
    return
  }

  await backendApi.client.put<
    { status: string; schedule_id: number },
    { instructor_ids: number[] }
  >(`/training/schedule/${scheduleId}/instructors`, {
    instructor_ids: toInstructorIds(relations.instructors),
  })
}

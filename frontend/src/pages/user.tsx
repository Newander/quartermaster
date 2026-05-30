import CrudResourcePage from "@/pages/crud-resource-page"
import type { CustomFormField } from "@/components/record-detail-sheet"
import { backendApi } from "@/lib/backend-api"

type UserPageProps = {
  currentRoute: string
}

const USER_CUSTOM_FIELDS: CustomFormField[] = [
  {
    name: "password",
    transcription: "Hasło",
    description: "Hasło początkowe użytkownika.",
    data_type: "str",
    ui_type: "password",
    nullable: false,
    modes: ["create"],
    required: true,
    writeOnly: true,
  },
  {
    name: "password",
    transcription: "Nowe hasło",
    description: "Wypełnij tylko wtedy, gdy chcesz zmienić hasło.",
    data_type: "str",
    ui_type: "password",
    nullable: true,
    modes: ["edit"],
    required: false,
    writeOnly: true,
  },
]

const toRelationIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item === "number") {
        return item
      }

      if (typeof item === "string") {
        const parsedValue = Number(item)
        return Number.isInteger(parsedValue) ? parsedValue : null
      }

      return null
    })
    .filter((item): item is number => item !== null)
}

const syncUserRoles = async (
  userId: number,
  relations: Record<string, unknown>
) => {
  if (!("roles" in relations)) {
    return
  }

  const selectedRoleIds = toRelationIds(relations.roles)
  const selectedRoleIdSet = new Set(selectedRoleIds)
  const user = await backendApi.client.get<Record<string, unknown>>(
    `/auth/user/${userId}`
  )
  const currentRoleIds = toRelationIds(
    Array.isArray(user.roles)
      ? user.roles.map((role) =>
          typeof role === "object" && role !== null
            ? (role as Record<string, unknown>).id
            : role
        )
      : []
  )
  const currentRoleIdSet = new Set(currentRoleIds)

  await Promise.all([
    ...selectedRoleIds
      .filter((roleId) => !currentRoleIdSet.has(roleId))
      .map((roleId) =>
        backendApi.client.post(`/auth/users/${userId}/roles/${roleId}`)
      ),
    ...currentRoleIds
      .filter((roleId) => !selectedRoleIdSet.has(roleId))
      .map((roleId) =>
        backendApi.client.delete(`/auth/users/${userId}/roles/${roleId}`)
      ),
  ])
}

export default function UserPage({ currentRoute }: UserPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/auth/user"
      uiBaseRoute="/user"
      schemaRoute="/auth/user"
      entityLabel="Użytkownik"
      emptyMessage="Brak użytkowników do wyświetlenia."
      detailTitleFields={["username"]}
      customFields={USER_CUSTOM_FIELDS}
      syncRelations={syncUserRoles}
      excludedColumns={[
        "id",
        "created_at",
        "updated_at",
        "refresh_sessions",
        "refresh_tokens",
      ]}
      deleteSuccessMessage={(record) =>
        `Usunięto użytkownika "${String(record.username ?? record.id)}".`
      }
    />
  )
}

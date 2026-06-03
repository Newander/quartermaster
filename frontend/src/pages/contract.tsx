import CrudResourcePage from "@/pages/crud-resource-page"
import { backendApi } from "@/lib/backend-api"

type ContractPageProps = {
  currentRoute: string
}

const toMemberIds = (value: unknown): number[] => {
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

const syncContractMembers = async (
  contractId: number,
  relations: Record<string, unknown>
) => {
  if (!Object.prototype.hasOwnProperty.call(relations, "member_contracts")) {
    return
  }

  await backendApi.client.put<
    {
      status: string
      contract_id: number
      assigned_count: number
      signed_count: number
      created_count: number
      removed_count: number
    },
    { member_ids: number[] }
  >(`/contract/${contractId}/members`, {
    member_ids: toMemberIds(relations.member_contracts),
  })
}

export default function ContractPage({ currentRoute }: ContractPageProps) {
  return (
    <CrudResourcePage
      currentRoute={currentRoute}
      baseRoute="/contract"
      schemaRoute="/contract"
      entityLabel="Document"
      emptyMessage="No documents to display."
      detailTitleFields={["title", "version"]}
      syncRelations={syncContractMembers}
      deleteSuccessMessage={(record) =>
        `Deleted document "${String(record.title ?? record.id)}".`
      }
    />
  )
}

import { DataTable } from "@/components/data-table"
import type { DataTableRowAction } from "@/components/data-table-row-actions"
import { RecordDetailSheet } from "@/components/record-detail-sheet"
import * as React from "react"
import {
  backendApi,
  type Member,
  type MemberUpdateInput,
} from "@/lib/backend-api"
import { Card, CardContent } from "@/components/ui/card"
import { navigateTo } from "@/lib/router"
import { RiArchiveLine, RiEyeLine } from "@remixicon/react"
import { toast } from "sonner"

const MEMBER_ROUTE_PREFIX = "/member/"
const MEMBER_SCHEMA_ROUTE = "/member"
const MEMBER_EXCLUDED_COLUMNS = ["created_at", "updated_at", "is_deleted", "id", "registration_date"]

const toContractIds = (value: unknown): number[] => {
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

const syncMemberContracts = async (
  memberId: number,
  relations: Record<string, unknown>
) => {
  if (!Object.prototype.hasOwnProperty.call(relations, "member_contracts")) {
    return
  }

  await backendApi.client.put<
    {
      status: string
      member_id: number
      assigned_count: number
      signed_count: number
      created_count: number
      removed_count: number
    },
    { contract_ids: number[] }
  >(`/contract/member/${memberId}/contracts`, {
    contract_ids: toContractIds(relations.member_contracts),
  })
}

const getMemberIdFromRoute = (route: string) => {
  if (!route.startsWith(MEMBER_ROUTE_PREFIX)) {
    return null
  }

  const recordId = Number(route.slice(MEMBER_ROUTE_PREFIX.length))
  return Number.isInteger(recordId) && recordId > 0 ? recordId : null
}

type MembersPageProps = {
  currentRoute: string
}

export default function MembersPage({ currentRoute }: MembersPageProps) {
  const selectedMemberId = getMemberIdFromRoute(currentRoute)
  const [reloadKey, setReloadKey] = React.useState(0)

  const handleArchive = React.useCallback(async (member: Member | null) => {
    if (!member) {
      toast.error("Unable to identify the record to archive.")
      return
    }

    try {
      await backendApi.deleteByRoute(MEMBER_SCHEMA_ROUTE, member.id)
      toast.success(
        `Archived ${member.first_name} ${member.last_name}.`
      )
      setReloadKey((current) => current + 1)
      navigateTo(MEMBER_SCHEMA_ROUTE, { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to archive the member."
      )
    }
  }, [])

  const memberRowActions: DataTableRowAction<Member>[] = [
    {
      label: "Open details",
      icon: RiEyeLine,
      onSelect: (member) => navigateTo(`/member/${member.id}`),
    },
    {
      label: "Archive",
      icon: RiArchiveLine,
      variant: "destructive",
      onSelect: (member) => void handleArchive(member),
    },
  ]

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <Card>
          <CardContent>
            <DataTable
              api={backendApi}
              schemaRoute={MEMBER_SCHEMA_ROUTE}
              reloadKey={reloadKey}
              currentRoute={currentRoute}
              createRouteBase={MEMBER_SCHEMA_ROUTE}
              excludedColumns={MEMBER_EXCLUDED_COLUMNS}
              withRowSelection
              getRowId={(row: Member) => row.id.toString()}
              emptyMessage="No members to display."
              rowActions={memberRowActions}
              syncRelations={syncMemberContracts}
            />
          </CardContent>
        </Card>
      </div>
      <RecordDetailSheet<Member>
        api={backendApi}
        schemaRoute={MEMBER_SCHEMA_ROUTE}
        baseRoute={MEMBER_SCHEMA_ROUTE}
        recordId={selectedMemberId}
        entityLabel="Member"
        readOnlyFields={MEMBER_EXCLUDED_COLUMNS}
        onClose={() => navigateTo(MEMBER_SCHEMA_ROUTE, { replace: true })}
        loadRecord={(memberId) => backendApi.member.getById(memberId)}
        updateRecord={(memberId, payload) =>
          backendApi.member.update(memberId, payload as MemberUpdateInput)
        }
        syncRelations={syncMemberContracts}
        onArchive={handleArchive}
        getRecordTitle={(member, memberId) =>
          member
            ? `${member.first_name} ${member.last_name}`
            : `Member #${memberId}`
        }
      />
    </div>
  )
}

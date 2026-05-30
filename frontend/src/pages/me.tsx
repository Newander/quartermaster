import * as React from "react"
import { RiShieldUserLine } from "@remixicon/react"

import { RecordDetailSheet } from "@/components/record-detail-sheet"
import type { CustomFormField } from "@/components/record-detail-sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { backendApi } from "@/lib/backend-api"
import { checkAuth, type AuthUser } from "@/lib/auth"

type MePageProps = {
  user: AuthUser
  onUserUpdate?: (user: AuthUser) => void
}

type UserProfileRecord = Record<string, unknown> & {
  id: number
}

const USER_SCHEMA_ROUTE = "/auth/user"
const USER_PROFILE_READ_ONLY_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "hashed_password",
  "roles",
  "permissions",
  "refresh_sessions",
]
const USER_PROFILE_CUSTOM_FIELDS: CustomFormField[] = [
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

const getInitials = (user: AuthUser) => {
  const source = user.username || user.email || "U"

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

const getMemberIdValue = (memberId: AuthUser["member_id"]) =>
  memberId == null ? "Brak powiązanego członka" : String(memberId)

const getAccountStatus = (isActive: AuthUser["is_active"]) => {
  if (isActive == null) {
    return {
      label: "Nieznany status",
      variant: "outline" as const,
    }
  }

  return isActive
    ? {
        label: "Aktywne konto",
        variant: "default" as const,
      }
    : {
        label: "Konto nieaktywne",
        variant: "secondary" as const,
      }
}

function AccountField({
  id,
  label,
  value,
  description,
  type = "text",
}: {
  id: string
  label: string
  value: string
  description: string
  type?: React.ComponentProps<typeof Input>["type"]
}) {
  return (
    <Field className="grid gap-2 border-b pb-4 last:border-b-0 last:pb-0 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-4">
      <FieldLabel
        htmlFor={id}
        className="pt-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
      >
        {label}
      </FieldLabel>
      <FieldContent>
        <Input id={id} type={type} value={value} readOnly className="h-10" />
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
    </Field>
  )
}

export default function MePage({ user, onUserUpdate }: MePageProps) {
  const accountStatus = getAccountStatus(user.is_active)
  const roleNames = user.roles.map((role) => role.name)
  const [isProfileEditorOpen, setIsProfileEditorOpen] = React.useState(false)

  const loadProfileRecord = React.useCallback(async (recordId: number) => {
    return backendApi.client.get<UserProfileRecord>(
      `${USER_SCHEMA_ROUTE}/${recordId}`
    )
  }, [])

  const updateProfileRecord = React.useCallback(
    async (recordId: number, payload: Record<string, unknown>) => {
      const updatedRecord = await backendApi.client.put<
        UserProfileRecord,
        Record<string, unknown>
      >(`${USER_SCHEMA_ROUTE}/${recordId}`, payload)

      const refreshedUser = await checkAuth()
      if (refreshedUser) {
        onUserUpdate?.(refreshedUser)
      }

      return updatedRecord
    },
    [onUserUpdate]
  )

  return (
    <>
      <div className="p-6">
        <div className="rounded-[2rem] p-4 shadow-sm sm:p-5">
          <Card className="mx-auto w-full max-w-3xl">
            <CardHeader className="gap-4 border-b">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar size="lg" className="size-14 rounded-2xl">
                  <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">
                    {getInitials(user)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <CardTitle className="text-xl">Profil użytkownika</CardTitle>
                  <CardDescription>
                    Данные текущего пользователя. Расширенные и внешние поля
                    редактируются в дефолтной карточке, как в DataTable.
                  </CardDescription>
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Badge variant={accountStatus.variant}>
                      {accountStatus.label}
                    </Badge>
                    {roleNames.length > 0 ? (
                      roleNames.map((roleName) => (
                        <Badge key={roleName} variant="outline">
                          {roleName}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">Brak ról</Badge>
                    )}
                  </div>
                </div>
                <CardAction className="self-start sm:mt-1">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <RiShieldUserLine className="size-4" />
                    Session profile
                  </div>
                </CardAction>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <FieldGroup>
                <div className="space-y-1">
                  <FieldTitle>Podstawowe informacje</FieldTitle>
                  <FieldDescription>
                    Read-only snapshot aktualnie zalogowanego użytkownika.
                  </FieldDescription>
                </div>

                <div className="space-y-4">
                  <AccountField
                    id="account-id"
                    label="ID użytkownika"
                    value={String(user.id)}
                    description="Wewnętrzny identyfikator konta w systemie."
                  />
                  <AccountField
                    id="account-username"
                    label="Username"
                    value={user.username}
                    description="Główna nazwa używana podczas logowania i identyfikacji użytkownika."
                  />
                  <AccountField
                    id="account-email"
                    label="Email"
                    type="email"
                    value={user.email}
                    description="Adres kontaktowy przypisany do konta."
                  />
                  <AccountField
                    id="account-member-id"
                    label="Member ID"
                    value={getMemberIdValue(user.member_id)}
                    description="Powiązanie z rekordem członka klubu, jeśli konto zostało spięte z profilem osoby."
                  />
                </div>
              </FieldGroup>

              <Separator />

              <FieldGroup>
                <div className="space-y-1">
                  <FieldTitle>Edycja profilu</FieldTitle>
                  <FieldDescription>
                    Otwórz domyślną kartę edycji (jak pod DataTable), aby
                    konfigurować pola zewnętrzne i relacje bieżącego
                    użytkownika.
                  </FieldDescription>
                </div>
                {!isProfileEditorOpen ? (
                  <Button
                    type="button"
                    onClick={() => setIsProfileEditorOpen(true)}
                  >
                    Otwórz kartę profilu
                  </Button>
                ) : null}
              </FieldGroup>
            </CardContent>

            <CardFooter className="justify-between gap-3 text-sm text-muted-foreground max-sm:flex-col max-sm:items-start">
              <span>
                Używana jest standardowa karta rekordu z sekcji DataTable.
              </span>
            </CardFooter>
          </Card>
        </div>
      </div>

      <RecordDetailSheet<UserProfileRecord>
        api={backendApi}
        schemaRoute={USER_SCHEMA_ROUTE}
        baseRoute="/me"
        recordId={isProfileEditorOpen ? user.id : null}
        entityLabel="Profil użytkownika"
        readOnlyFields={USER_PROFILE_READ_ONLY_FIELDS}
        customFields={USER_PROFILE_CUSTOM_FIELDS}
        onClose={() => setIsProfileEditorOpen(false)}
        loadRecord={loadProfileRecord}
        updateRecord={updateProfileRecord}
      />
    </>
  )
}

import { useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type LoginFormValues = {
  identifier: string
  password: string
}

export function LoginForm({
  className,
  onLogin,
  error,
  isSubmitting,
  ...props
}: React.ComponentProps<"div"> & {
  onLogin?: (values: LoginFormValues) => void | Promise<void>
  error?: string | null
  isSubmitting?: boolean
}) {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onLogin?.({ identifier, password })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Zaloguj się do systemu</CardTitle>
          <CardDescription>
            Wpisz adres e-mail lub login oraz hasło, aby otworzyć panel klubu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">E-mail lub login</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="club@hema-garden.local lub club-admin"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Hasło</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Nie pamiętasz hasła?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <FieldDescription>
                  Wpisz hasło konta otrzymane od administratora.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Logowanie..." : "Zaloguj"}
                </Button>
                <FieldError>{error}</FieldError>
                <FieldDescription className="text-center">
                  Konto tworzy administrator klubu.{" "}
                  <a href="#">Skontaktuj się</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

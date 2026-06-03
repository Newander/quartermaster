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
          <CardTitle>Sign in to Quartermaster</CardTitle>
          <CardDescription>
            Enter your username or email and password to open the club dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="club@hema-garden.local or club-admin"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot password?
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
                  Use the password provided by the club administrator.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Button>
                <FieldError>{error}</FieldError>
                <FieldDescription className="text-center">
                  Accounts are created by a club administrator.{" "}
                  <a href="#">Contact support</a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

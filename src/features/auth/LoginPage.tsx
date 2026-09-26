import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { loginSchema } from '@domain/schemas.ts'
import { FormAlert } from '@/components/shared/FormAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AuthHeading } from './AuthHeading'
import { useLogin } from './queries'

/** Prefilled so the demo starts with one click; GuestOnly handles the redirect on success. */
export function LoginPage() {
  const login = useLogin()
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: 'demo@stocksense.in', password: 'demo1234' },
  })
  const { errors } = form.formState

  return (
    <>
      <AuthHeading title="Sign in to StockSense" description="The demo account is filled in — or use your own." />
      <form onSubmit={form.handleSubmit((values) => login.mutate(values))} className="grid gap-4" noValidate>
        <FormAlert message={login.error?.message} />
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...form.register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{' '}
        <Link to="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { signupSchema } from '@domain/schemas.ts'
import { FormAlert } from '@/components/shared/FormAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { AuthHeading } from './AuthHeading'
import { useSignup } from './queries'

export function SignupPage() {
  const signup = useSignup()
  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    signup.mutate(values, {
      onError: (e) => {
        if (!(e instanceof ApiError)) return
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          if (field === 'name' || field === 'email' || field === 'password') form.setError(field, { message: messages?.[0] })
        }
      },
    }),
  )

  return (
    <>
      <AuthHeading title="Create your account" description="Start tracking stock across every warehouse." />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormAlert message={signup.error?.message} />
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby="password-hint"
            {...form.register('password')}
          />
          {errors.password ? <FieldError errors={[errors.password]} /> : <FieldDescription id="password-hint">At least 8 characters.</FieldDescription>}
        </Field>
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={signup.isPending}>
          {signup.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { otpRequestSchema, signupSchema } from '@domain/schemas.ts'
import { FormAlert } from '@/components/shared/FormAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { AuthHeading } from './AuthHeading'
import { useRequestOtp, useResetPassword, useVerifyOtp } from './queries'

type Step = 'email' | 'otp' | 'password'

/** OTP reset per the spec: email → 6-digit code (verified server-side) → new password. */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const request = useRequestOtp()
  const verify = useVerifyOtp()
  const reset = useResetPassword()
  const serverError = step === 'email' ? request.error : step === 'otp' ? verify.error : reset.error

  function sendCode() {
    const parsed = otpRequestSchema.safeParse({ email })
    if (!parsed.success) return setFieldError(parsed.error.issues[0].message)
    setFieldError(null)
    request.mutate(parsed.data, {
      onSuccess: () => {
        setCode('')
        setStep('otp')
      },
    })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (step === 'email') return sendCode()
    if (step === 'otp') {
      return verify.mutate({ email, code }, { onSuccess: () => setStep('password') })
    }
    const parsed = signupSchema.shape.password.safeParse(password)
    if (!parsed.success) return setFieldError(parsed.error.issues[0].message)
    setFieldError(null)
    reset.mutate(
      { email, code, password },
      {
        onSuccess: (res) => {
          toast.success(res.message)
          navigate('/login')
        },
        onError: () => setStep('otp'),
      },
    )
  }

  return (
    <>
      {step === 'email' && <AuthHeading title="Reset your password" description="We'll send a 6-digit code to your email." />}
      {step === 'otp' && <AuthHeading title="Enter the code" description={`Sent to ${email}. It expires in 5 minutes.`} />}
      {step === 'password' && <AuthHeading title="Choose a new password" description="You'll be signed out everywhere else." />}

      <form onSubmit={submit} className="grid gap-4" noValidate>
        <FormAlert message={serverError?.message} />

        {step === 'email' && (
          <Field data-invalid={!!fieldError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" type="email" autoComplete="email" value={email} aria-invalid={!!fieldError} onChange={(e) => setEmail(e.target.value)} />
            <FieldError>{fieldError}</FieldError>
          </Field>
        )}

        {step === 'otp' && (
          <>
            {request.data?.demoCode && (
              <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground" data-testid="demo-otp">
                Demo mode — no email server is connected. Your code is{' '}
                <span className="font-mono text-sm font-medium tracking-widest text-foreground">{request.data.demoCode}</span>
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="otp">Verification code</FieldLabel>
              <InputOTP id="otp" maxLength={6} value={code} onChange={setCode} autoFocus inputMode="numeric">
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Field>
          </>
        )}

        {step === 'password' && (
          <Field data-invalid={!!fieldError}>
            <FieldLabel htmlFor="new-password">New password</FieldLabel>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              aria-invalid={!!fieldError}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {fieldError ? <FieldError>{fieldError}</FieldError> : <FieldDescription>At least 8 characters.</FieldDescription>}
          </Field>
        )}

        <Button
          type="submit"
          size="lg"
          className="mt-1 w-full"
          disabled={request.isPending || verify.isPending || reset.isPending || (step === 'otp' && code.length < 6)}
        >
          {step === 'email' ? 'Send code' : step === 'otp' ? 'Verify code' : 'Update password'}
        </Button>

        {step === 'otp' && (
          <Button type="button" variant="ghost" size="sm" onClick={sendCode} disabled={request.isPending} className="justify-self-center text-muted-foreground">
            Send a new code
          </Button>
        )}
      </form>

      <Button variant="ghost" size="sm" asChild className="mt-6 text-muted-foreground">
        <Link to="/login">
          <ArrowLeft data-icon="inline-start" />
          Back to sign in
        </Link>
      </Button>
    </>
  )
}

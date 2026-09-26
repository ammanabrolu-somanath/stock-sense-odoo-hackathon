import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { AuthHeading } from './AuthHeading'

type Step = 'email' | 'otp' | 'password'

/** Three-step OTP reset: email → 6-digit code → new password. Wired to the API in H3. */
export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')

  function next(e: FormEvent) {
    e.preventDefault()
    if (step === 'email') setStep('otp')
    else if (step === 'otp') setStep('password')
    else navigate('/login')
  }

  return (
    <>
      {step === 'email' && (
        <AuthHeading title="Reset your password" description="We'll send a 6-digit code to your email." />
      )}
      {step === 'otp' && (
        <AuthHeading title="Enter the code" description={`Sent to ${email || 'your email'}. It expires in 5 minutes.`} />
      )}
      {step === 'password' && <AuthHeading title="Choose a new password" description="At least 8 characters." />}

      <form onSubmit={next} className="grid gap-4">
        {step === 'email' && (
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        {step === 'otp' && (
          <div className="grid gap-1.5">
            <Label htmlFor="otp">Verification code</Label>
            <InputOTP id="otp" maxLength={6} value={otp} onChange={setOtp} autoFocus>
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
        )}
        {step === 'password' && (
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
        )}
        <Button type="submit" size="lg" className="mt-1 w-full" disabled={step === 'otp' && otp.length < 6}>
          {step === 'email' ? 'Send code' : step === 'otp' ? 'Verify code' : 'Update password'}
        </Button>
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

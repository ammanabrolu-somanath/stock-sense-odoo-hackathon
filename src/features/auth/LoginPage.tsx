import { type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthHeading } from './AuthHeading'

export function LoginPage() {
  const navigate = useNavigate()

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    // Session handling lands in H3; the UI flow is complete now.
    navigate('/')
  }

  return (
    <>
      <AuthHeading title="Sign in to StockSense" description="Use the demo account below, or create your own." />
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" defaultValue="demo@stocksense.in" required />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" defaultValue="demo1234" required />
        </div>
        <Button type="submit" size="lg" className="mt-1 w-full">
          Sign in
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

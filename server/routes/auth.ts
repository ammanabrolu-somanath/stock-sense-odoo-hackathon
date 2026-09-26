import { Router, type CookieOptions, type Request, type Response } from 'express'
import { rateLimit } from 'express-rate-limit'

import { loginSchema, otpRequestSchema, otpResetSchema, otpVerifySchema, signupSchema } from '@domain/schemas.ts'
import type { AppContext } from '../context.ts'
import { parse, SESSION_COOKIE } from '../http.ts'

const isProd = process.env.NODE_ENV === 'production'
/** No email server in the demo: the OTP is returned so the UI can show it. Set OTP_DEMO_MODE=false to disable. */
const otpDemoMode = process.env.OTP_DEMO_MODE !== 'false'

/**
 * Two layers: per client IP, and per account (the email being attacked). The per-account
 * limit is what stops brute force on one user — it holds even if an attacker rotates IPs or
 * forges X-Forwarded-For, which is why it doesn't depend on proxy configuration at all.
 */
const limiter = (limit: number, windowMinutes: number, by: 'ip' | 'account' = 'ip') =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit: isProd ? limit : limit * 20,
    ...(by === 'account' ? { keyGenerator: (req: Request) => `account:${String(req.body?.email ?? '').trim().toLowerCase()}` } : {}),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Wait a few minutes and try again.' } },
  })

function setSession(res: Response, token: string, expiresAt: string) {
  const options: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', expires: new Date(expiresAt) }
  res.cookie(SESSION_COOKIE, token, options)
}

export function authRoutes(ctx: AppContext): Router {
  const r = Router()
  const credentialLimiter = limiter(20, 5)
  const accountLoginLimiter = limiter(10, 15, 'account')
  const otpLimiter = limiter(8, 15)
  const accountOtpLimiter = limiter(8, 15, 'account')

  r.post('/signup', credentialLimiter, (req, res) => {
    const { user, token, expiresAt } = ctx.auth.signup(parse(signupSchema, req.body))
    setSession(res, token, expiresAt)
    res.status(201).json({ user })
  })

  r.post('/login', credentialLimiter, accountLoginLimiter, (req, res) => {
    const { user, token, expiresAt } = ctx.auth.login(parse(loginSchema, req.body))
    setSession(res, token, expiresAt)
    res.json({ user })
  })

  r.post('/logout', (req, res) => {
    ctx.auth.logout(req.cookies?.[SESSION_COOKIE])
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    res.status(204).end()
  })

  // 'Who am I?' has a valid answer when signed out (nobody), so it is 200 either way —
  // a 401 here would print a red network error on every visit to the sign-in page.
  r.get('/me', (req, res) => {
    res.json({ user: ctx.auth.userForToken(req.cookies?.[SESSION_COOKIE]) ?? null })
  })

  r.post('/otp/request', otpLimiter, accountOtpLimiter, (req, res) => {
    const { email } = parse(otpRequestSchema, req.body)
    const { code } = ctx.auth.requestOtp(email)
    res.json({
      ok: true,
      message: 'If an account exists for that email, a 6-digit code is on its way. It expires in 5 minutes.',
      ...(otpDemoMode && code ? { demoCode: code } : {}),
    })
  })

  r.post('/otp/verify', otpLimiter, accountOtpLimiter, (req, res) => {
    const { email, code } = parse(otpVerifySchema, req.body)
    ctx.auth.verifyOtp(email, code)
    res.json({ ok: true })
  })

  r.post('/otp/reset', otpLimiter, accountOtpLimiter, (req, res) => {
    ctx.auth.resetPassword(parse(otpResetSchema, req.body))
    res.json({ ok: true, message: 'Password updated. Sign in with your new password.' })
  })

  return r
}

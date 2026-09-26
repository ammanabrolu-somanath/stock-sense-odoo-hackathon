import { expect, test } from './fixtures'

test.describe('@smoke authentication', () => {
  test('sign up → log out → reset password with OTP → sign in with the new password', async ({ page }) => {
    const email = `e2e.${Date.now()}@stocksense.test`

    // Sign up
    await page.goto('/signup')
    await page.getByLabel('Full name').fill('Meera Iyer')
    await page.getByLabel('Work email').fill(email)
    await page.getByLabel('Password').fill('first-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Profile menu' })).toContainText('Meera Iyer')

    // Log out from the sidebar profile menu
    await page.getByRole('button', { name: 'Profile menu' }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    // Forgot password: email → OTP (demo mode shows it) → new password
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: 'Send code' }).click()
    const code = (await page.getByTestId('demo-otp').locator('span').textContent())?.trim() ?? ''
    expect(code).toMatch(/^\d{6}$/)
    await page.keyboard.type(code)
    await page.getByRole('button', { name: 'Verify code' }).click()
    await page.getByLabel('New password').fill('second-password')
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page).toHaveURL(/\/login$/)

    // Old password no longer works; new one does
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('first-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.')
    await page.getByLabel('Password').fill('second-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  })

  test('a wrong code is rejected with the attempts left', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill('demo@stocksense.in')
    await page.getByRole('button', { name: 'Send code' }).click()
    const code = (await page.getByTestId('demo-otp').locator('span').textContent())?.trim() ?? ''
    await page.keyboard.type(code === '000000' ? '111111' : '000000')
    await page.getByRole('button', { name: 'Verify code' }).click()
    await expect(page.getByRole('alert')).toContainText('attempts left')
  })
})

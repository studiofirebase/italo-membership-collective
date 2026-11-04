const localAdminTestMode =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
  Boolean(import.meta.env.ADMIN_TEST_EMAIL && import.meta.env.ADMIN_TEST_PASSWORD)

export function isLocalAdminTestEnabled() {
  return localAdminTestMode
}

export function isLocalAdminTestSession() {
  return (
    localAdminTestMode &&
    window.sessionStorage.getItem('local-admin-test-session') === 'active'
  )
}

export function signInLocalAdminTest(email: string, password: string) {
  if (!localAdminTestMode || !matchesLocalAdminCredentials(email, password)) return false

  window.sessionStorage.setItem('local-admin-test-session', 'active')
  return true
}

function matchesLocalAdminCredentials(email: string, password: string) {
  const expectedEmail = import.meta.env.ADMIN_TEST_EMAIL?.trim().toLowerCase()
  const expectedPassword = import.meta.env.ADMIN_TEST_PASSWORD
  return (
    expectedEmail !== undefined &&
    expectedPassword !== undefined &&
    expectedEmail === email.trim().toLowerCase() &&
    expectedPassword.length > 0 &&
    password === expectedPassword
  )
}

export function signOutLocalAdminTest() {
  window.sessionStorage.removeItem('local-admin-test-session')
}

export function getLocalAdminTestEmail() {
  return localAdminTestMode ? import.meta.env.ADMIN_TEST_EMAIL?.trim().toLowerCase() ?? '' : ''
}

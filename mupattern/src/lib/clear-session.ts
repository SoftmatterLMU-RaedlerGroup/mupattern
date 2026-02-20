const SESSION_KEY = "mupattern-session"

export function clearAppSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

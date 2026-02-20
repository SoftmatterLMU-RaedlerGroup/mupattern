const SESSION_KEYS = ["mupattern-register-app", "mupattern-see-viewer"]

export function clearAppSession(): void {
  for (const key of SESSION_KEYS) {
    sessionStorage.removeItem(key)
  }
}

/** Persistencia del onboarding (Fase 5). Clave por usuario en localStorage. */

const STORAGE_PREFIX = 'ctf_onboarding_done_v1:'
/** Compat: tip antiguo de Inicio — se marca al completar/saltar el wizard. */
const LEGACY_TIP_KEY = 'ctf_onboarding_tip_v1'

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function isOnboardingDone(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function markOnboardingDone(userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), '1')
    localStorage.setItem(LEGACY_TIP_KEY, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/** Para retest manual: borra el flag del usuario actual. */
export function clearOnboardingDone(userId: string): void {
  try {
    localStorage.removeItem(storageKey(userId))
  } catch {
    /* ignore */
  }
}

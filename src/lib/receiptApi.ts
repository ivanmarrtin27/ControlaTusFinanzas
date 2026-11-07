/**
 * Tickets / recibos en Supabase Storage (bucket `receipts`).
 *
 * Ruta: `{userId}/{transactionId}/{timestamp-nombre}`.
 * Solo se guarda el path en la fila del movimiento; la URL firmada se genera al ver.
 * Límites: imagen ≤ 5 MB (JPEG/PNG/WebP/HEIC).
 */
import { MoneyApiError } from '@/lib/moneyApi'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

const BUCKET = 'receipts'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function throwFromError(error: { message: string } | null): never {
  throw new MoneyApiError(error?.message ?? 'Error desconocido de Storage')
}

/** Sanitiza el nombre y fuerza una extensión razonable. */
function safeFilename(file: File): string {
  const raw = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80)
  const ext =
    raw.includes('.')
      ? raw.slice(raw.lastIndexOf('.'))
      : file.type === 'image/png'
        ? '.png'
        : file.type === 'image/webp'
          ? '.webp'
          : '.jpg'
  const base = raw.includes('.') ? raw.slice(0, raw.lastIndexOf('.')) : raw || 'ticket'
  return `${Date.now()}-${base}${ext}`
}

export function validateReceiptFile(file: File): void {
  if (!ALLOWED.has(file.type) && !file.type.startsWith('image/')) {
    throw new MoneyApiError('El ticket debe ser una imagen (JPEG, PNG, WebP o HEIC).')
  }
  if (file.size > MAX_BYTES) {
    throw new MoneyApiError('La imagen supera el límite de 5 MB.')
  }
}

export function buildReceiptPath(userId: string, transactionId: string, file: File): string {
  return `${userId}/${transactionId}/${safeFilename(file)}`
}

export async function uploadReceipt(
  userId: string,
  transactionId: string,
  file: File,
): Promise<string> {
  ensureConfigured()
  validateReceiptFile(file)
  const path = buildReceiptPath(userId, transactionId, file)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })
  if (error) throwFromError(error)
  return path
}

export async function deleteReceipt(path: string): Promise<void> {
  ensureConfigured()
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throwFromError(error)
}

export async function createReceiptSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  ensureConfigured()
  if (!path) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn)
  if (error) throwFromError(error)
  return data.signedUrl
}

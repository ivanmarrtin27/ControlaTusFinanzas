import { humanizeSupabaseError, MoneyApiError } from '@/lib/moneyApi'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Database, Tag, TransactionTag } from '@/types/database'

type TagInsert = Database['public']['Tables']['tags']['Insert']
type TagUpdate = Database['public']['Tables']['tags']['Update']

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function throwFromError(error: { message: string } | null): never {
  throw new MoneyApiError(humanizeSupabaseError(error?.message ?? 'Error desconocido de Supabase'))
}

export async function listTags(userId: string): Promise<Tag[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throwFromError(error)
  return (data as Tag[]) ?? []
}

export async function createTag(payload: TagInsert): Promise<Tag> {
  ensureConfigured()
  const { data, error } = await supabase.from('tags').insert(payload).select('*').single()
  if (error) throwFromError(error)
  return data as Tag
}

export async function updateTag(id: string, payload: TagUpdate): Promise<Tag> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('tags')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return data as Tag
}

export async function deleteTag(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throwFromError(error)
}

export async function listTransactionTags(userId: string): Promise<TransactionTag[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transaction_tags')
    .select('*')
    .eq('user_id', userId)
  if (error) throwFromError(error)
  return (data as TransactionTag[]) ?? []
}

export async function setTransactionTags(
  userId: string,
  transactionId: string,
  tagIds: string[],
): Promise<void> {
  ensureConfigured()
  const { error: delError } = await supabase
    .from('transaction_tags')
    .delete()
    .eq('user_id', userId)
    .eq('transaction_id', transactionId)
  if (delError) throwFromError(delError)

  const unique = [...new Set(tagIds.filter(Boolean))]
  if (unique.length === 0) return

  const rows = unique.map((tag_id) => ({
    user_id: userId,
    transaction_id: transactionId,
    tag_id,
  }))
  const { error } = await supabase.from('transaction_tags').insert(rows)
  if (error) throwFromError(error)
}

/** Mapa transaction_id → tag ids */
export function buildTagsByTransaction(
  links: TransactionTag[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const link of links) {
    const list = map.get(link.transaction_id) ?? []
    list.push(link.tag_id)
    map.set(link.transaction_id, list)
  }
  return map
}

import { MoneyApiError } from '@/lib/moneyApi'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { toNumber } from '@/lib/balances'
import type { Database, TransactionTemplate } from '@/types/database'

type TemplateInsert = Database['public']['Tables']['transaction_templates']['Insert']
type TemplateUpdate = Database['public']['Tables']['transaction_templates']['Update']

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new MoneyApiError(
      'Supabase no está configurado. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.',
    )
  }
}

function throwFromError(error: { message: string } | null): never {
  throw new MoneyApiError(error?.message ?? 'Error desconocido de Supabase')
}

function mapTemplate(row: TransactionTemplate): TransactionTemplate {
  return { ...row, amount: toNumber(row.amount) }
}

export async function listTemplates(userId: string): Promise<TransactionTemplate[]> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transaction_templates')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throwFromError(error)
  return ((data as TransactionTemplate[]) ?? []).map(mapTemplate)
}

export async function createTemplate(payload: TemplateInsert): Promise<TransactionTemplate> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transaction_templates')
    .insert(payload)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapTemplate(data as TransactionTemplate)
}

export async function updateTemplate(
  id: string,
  payload: TemplateUpdate,
): Promise<TransactionTemplate> {
  ensureConfigured()
  const { data, error } = await supabase
    .from('transaction_templates')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throwFromError(error)
  return mapTemplate(data as TransactionTemplate)
}

export async function deleteTemplate(id: string): Promise<void> {
  ensureConfigured()
  const { error } = await supabase.from('transaction_templates').delete().eq('id', id)
  if (error) throwFromError(error)
}

/** Ejemplos opcionales la primera vez que el usuario no tiene plantillas. */
export async function seedExampleTemplates(userId: string): Promise<TransactionTemplate[]> {
  const examples: TemplateInsert[] = [
    {
      user_id: userId,
      name: 'Café',
      type: 'expense',
      amount: 2.5,
      note: null,
      sort_order: 0,
    },
    {
      user_id: userId,
      name: 'Supermercado',
      type: 'expense',
      amount: 40,
      note: null,
      sort_order: 1,
    },
    {
      user_id: userId,
      name: 'Nómina',
      type: 'income',
      amount: 1500,
      note: null,
      sort_order: 2,
    },
  ]

  const created: TransactionTemplate[] = []
  for (const row of examples) {
    created.push(await createTemplate(row))
  }
  return created
}

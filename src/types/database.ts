export type AccountType = 'bank' | 'cash' | 'card' | 'savings' | 'other'
export type CategoryKind = 'income' | 'expense'
export type TransactionType = 'income' | 'expense'
export type GoalStatus = 'active' | 'paused' | 'completed'
export type DebtDirection = 'owe' | 'owed'
export type DebtStatus = 'pending' | 'settled'
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

export type Profile = {
  id: string
  display_name: string | null
  accent_color: string
  currency: string
  locale: string
  emergency_fund_target: number | null
  created_at: string
  updated_at: string
}

export type Account = {
  id: string
  user_id: string
  name: string
  type: AccountType
  color: string
  opening_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Category = {
  id: string
  user_id: string
  name: string
  kind: CategoryKind
  color: string
  icon: string | null
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  amount: number
  concept: string
  note: string | null
  occurred_at: string
  is_cleared: boolean
  recurring_id: string | null
  debt_id: string | null
  /** Path in private Storage bucket `receipts` (not a public URL). */
  receipt_path: string | null
  created_at: string
  updated_at: string
}

export type TransactionTemplate = {
  id: string
  user_id: string
  name: string
  type: TransactionType
  amount: number
  account_id: string | null
  category_id: string | null
  note: string | null
  sort_order: number
  created_at: string
}

export type Transfer = {
  id: string
  user_id: string
  from_account_id: string
  to_account_id: string
  amount: number
  concept: string | null
  occurred_at: string
  created_at: string
  updated_at: string
}

export type Budget = {
  id: string
  user_id: string
  category_id: string
  amount_limit: number
  period_month: string
  created_at: string
  updated_at: string
}

export type RecurringRule = {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  concept: string
  account_id: string | null
  category_id: string | null
  frequency: RecurringFrequency
  next_occurrence: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Goal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  status: GoalStatus
  color: string
  deadline: string | null
  created_at: string
  updated_at: string
}

export type GoalContribution = {
  id: string
  user_id: string
  goal_id: string
  account_id: string
  amount: number
  occurred_at: string
  transaction_id: string | null
  created_at: string
}

export type Debt = {
  id: string
  user_id: string
  direction: DebtDirection
  person_name: string
  principal: number
  remaining: number
  status: DebtStatus
  due_date: string | null
  created_at: string
  updated_at: string
}

export type Tag = {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

export type TransactionTag = {
  transaction_id: string
  tag_id: string
  user_id: string
  created_at: string
}

export type DebtPayment = {
  id: string
  user_id: string
  debt_id: string
  amount: number
  occurred_at: string
  transaction_id: string | null
  created_at: string
}

type Tables = {
  profiles: {
    Row: Profile
    Insert: {
      id: string
      display_name?: string | null
      accent_color?: string
      currency?: string
      locale?: string
      emergency_fund_target?: number | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      display_name?: string | null
      accent_color?: string
      currency?: string
      locale?: string
      emergency_fund_target?: number | null
      updated_at?: string
    }
    Relationships: []
  }
  accounts: {
    Row: Account
    Insert: {
      id?: string
      user_id: string
      name: string
      type?: AccountType
      color?: string
      opening_balance?: number
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      name?: string
      type?: AccountType
      color?: string
      opening_balance?: number
      is_active?: boolean
      updated_at?: string
    }
    Relationships: []
  }
  categories: {
    Row: Category
    Insert: {
      id?: string
      user_id: string
      name: string
      kind: CategoryKind
      color?: string
      icon?: string | null
      is_active?: boolean
      is_system?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      name?: string
      kind?: CategoryKind
      color?: string
      icon?: string | null
      is_active?: boolean
      is_system?: boolean
      updated_at?: string
    }
    Relationships: []
  }
  transactions: {
    Row: Transaction
    Insert: {
      id?: string
      user_id: string
      account_id: string
      category_id?: string | null
      type: TransactionType
      amount: number
      concept: string
      note?: string | null
      occurred_at?: string
      is_cleared?: boolean
      recurring_id?: string | null
      debt_id?: string | null
      receipt_path?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      account_id?: string
      category_id?: string | null
      type?: TransactionType
      amount?: number
      concept?: string
      note?: string | null
      occurred_at?: string
      is_cleared?: boolean
      recurring_id?: string | null
      debt_id?: string | null
      receipt_path?: string | null
      updated_at?: string
    }
    Relationships: []
  }
  transaction_templates: {
    Row: TransactionTemplate
    Insert: {
      id?: string
      user_id: string
      name: string
      type: TransactionType
      amount: number
      account_id?: string | null
      category_id?: string | null
      note?: string | null
      sort_order?: number
      created_at?: string
    }
    Update: {
      name?: string
      type?: TransactionType
      amount?: number
      account_id?: string | null
      category_id?: string | null
      note?: string | null
      sort_order?: number
    }
    Relationships: []
  }
  transfers: {
    Row: Transfer
    Insert: {
      id?: string
      user_id: string
      from_account_id: string
      to_account_id: string
      amount: number
      concept?: string | null
      occurred_at?: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      from_account_id?: string
      to_account_id?: string
      amount?: number
      concept?: string | null
      occurred_at?: string
      updated_at?: string
    }
    Relationships: []
  }
  budgets: {
    Row: Budget
    Insert: {
      id?: string
      user_id: string
      category_id: string
      amount_limit: number
      period_month: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      category_id?: string
      amount_limit?: number
      period_month?: string
      updated_at?: string
    }
    Relationships: []
  }
  recurring_rules: {
    Row: RecurringRule
    Insert: {
      id?: string
      user_id: string
      type: TransactionType
      amount: number
      concept: string
      account_id?: string | null
      category_id?: string | null
      frequency?: RecurringFrequency
      next_occurrence: string
      is_active?: boolean
      created_at?: string
      updated_at?: string
    }
    Update: {
      type?: TransactionType
      amount?: number
      concept?: string
      account_id?: string | null
      category_id?: string | null
      frequency?: RecurringFrequency
      next_occurrence?: string
      is_active?: boolean
      updated_at?: string
    }
    Relationships: []
  }
  goals: {
    Row: Goal
    Insert: {
      id?: string
      user_id: string
      name: string
      target_amount: number
      current_amount?: number
      status?: GoalStatus
      color?: string
      deadline?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      name?: string
      target_amount?: number
      current_amount?: number
      status?: GoalStatus
      color?: string
      deadline?: string | null
      updated_at?: string
    }
    Relationships: []
  }
  goal_contributions: {
    Row: GoalContribution
    Insert: {
      id?: string
      user_id: string
      goal_id: string
      account_id: string
      amount: number
      occurred_at?: string
      transaction_id?: string | null
      created_at?: string
    }
    Update: {
      account_id?: string
      amount?: number
      occurred_at?: string
      transaction_id?: string | null
    }
    Relationships: []
  }
  debts: {
    Row: Debt
    Insert: {
      id?: string
      user_id: string
      direction: DebtDirection
      person_name: string
      principal: number
      remaining: number
      status?: DebtStatus
      due_date?: string | null
      created_at?: string
      updated_at?: string
    }
    Update: {
      direction?: DebtDirection
      person_name?: string
      principal?: number
      remaining?: number
      status?: DebtStatus
      due_date?: string | null
      updated_at?: string
    }
    Relationships: []
  }
  tags: {
    Row: Tag
    Insert: {
      id?: string
      user_id: string
      name: string
      color?: string
      created_at?: string
      updated_at?: string
    }
    Update: {
      name?: string
      color?: string
      updated_at?: string
    }
    Relationships: []
  }
  transaction_tags: {
    Row: TransactionTag
    Insert: {
      transaction_id: string
      tag_id: string
      user_id: string
      created_at?: string
    }
    Update: {
      tag_id?: string
    }
    Relationships: []
  }
  debt_payments: {
    Row: DebtPayment
    Insert: {
      id?: string
      user_id: string
      debt_id: string
      amount: number
      occurred_at?: string
      transaction_id?: string | null
      created_at?: string
    }
    Update: {
      amount?: number
      occurred_at?: string
      transaction_id?: string | null
    }
    Relationships: []
  }
}

export type Database = {
  public: {
    Tables: Tables
    Views: {
      [_ in never]: never
    }
    Functions: {
      replace_user_backup: {
        Args: { p_payload: Record<string, unknown> }
        Returns: undefined
      }
    }
    Enums: {
      account_type: AccountType
      category_kind: CategoryKind
      transaction_type: TransactionType
      goal_status: GoalStatus
      debt_direction: DebtDirection
      debt_status: DebtStatus
      recurring_frequency: RecurringFrequency
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

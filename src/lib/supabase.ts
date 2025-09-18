import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-application': 'farmageniuscaixa'
    }
  }
})

// Tipos para as tabelas
export interface Profile {
  id: string
  username: string
  full_name?: string
  avatar_url?: string
  role: 'admin' | 'user' | 'viewer'
  is_active: boolean
}

export interface BankingTransaction {
  id: string
  transaction_date: string
  payment_type: string
  cpf?: string
  value: number
  original_history?: string
  status: 'pending' | 'conferred' | 'not_found' | 'archived'
  is_transferred: boolean
}

export interface CashConference {
  id: string
  conferred_value: number
  conference_date: string
  transaction_date: string
  payment_type: string
  cpf?: string
  original_value: number
  original_history?: string
}

// Funções utilitárias para interagir com o banco
export const supabaseApi = {
  // Buscar transações por valor
  searchTransactionsByValue: async (userId: string, value: number) => {
    const { data, error } = await supabase.rpc('search_transactions_by_value', {
      p_user_id: userId,
      p_value: value
    })
    return { data, error }
  },

  // Transferir para conferência
  transferToConference: async (userId: string, transactionId: string) => {
    const { data, error } = await supabase.rpc('transfer_to_conference', {
      p_user_id: userId,
      p_transaction_id: transactionId
    })
    return { data, error }
  },

  // Remover da conferência
  removeFromConference: async (userId: string, conferenceId: string) => {
    const { data, error } = await supabase.rpc('remove_from_conference', {
      p_user_id: userId,
      p_conference_id: conferenceId
    })
    return { data, error }
  },

  // Registrar valor não encontrado
  registerNotFound: async (userId: string, searchedValue: string, normalizedValue: number) => {
    const { data, error } = await supabase.rpc('register_not_found', {
      p_user_id: userId,
      p_searched_value: searchedValue,
      p_normalized_value: normalizedValue
    })
    return { data, error }
  },

  // Obter estatísticas do usuário
  getUserStats: async (userId: string) => {
    const { data, error } = await supabase.rpc('get_user_stats', {
      p_user_id: userId
    })
    return { data, error }
  },

  // Reiniciar dia de trabalho
  restartWorkDay: async (userId: string) => {
    const { data, error } = await supabase.rpc('restart_work_day', {
      p_user_id: userId
    })
    return { data, error }
  },

  // Inserir transações bancárias em lote
  insertBankingTransactions: async (userId: string, fileId: string, transactions: any[]) => {
    const transactionsWithMeta = transactions.map((t, index) => ({
      file_id: fileId,
      user_id: userId,
      transaction_date: t.date,
      payment_type: t.paymentType,
      cpf: t.cpf,
      value: t.value,
      original_history: t.originalHistory,
      row_index: index,
      original_data: t
    }))

    const { data, error } = await supabase
      .from('banking_transactions')
      .insert(transactionsWithMeta)
      .select()

    return { data, error }
  },

  // Obter conferências ativas
  getActiveConferences: async (userId: string) => {
    const { data, error } = await supabase
      .from('cash_conference')
      .select('*')
      .eq('user_id', userId)
      .eq('conference_status', 'active')
      .order('conference_date', { ascending: false })

    return { data, error }
  },

  // Obter histórico de não encontrados
  getNotFoundHistory: async (userId: string) => {
    const { data, error } = await supabase
      .from('not_found_history')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'not_found')
      .order('search_timestamp', { ascending: false })

    return { data, error }
  }
}
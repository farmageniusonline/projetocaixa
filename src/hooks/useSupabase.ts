import { useState, useCallback } from 'react';
import { supabaseApi } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Hook para funcionalidades do sistema de conferência
export const useSupabase = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Buscar transações por valor
  const searchTransactionsByValue = useCallback(async (value: number) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.searchTransactionsByValue(user.id, value);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Transferir transação para conferência
  const transferToConference = useCallback(async (transactionId: string) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.transferToConference(user.id, transactionId);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao transferir';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Remover da conferência
  const removeFromConference = useCallback(async (conferenceId: string) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.removeFromConference(user.id, conferenceId);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Registrar valor não encontrado
  const registerNotFound = useCallback(async (searchedValue: string, normalizedValue: number) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.registerNotFound(user.id, searchedValue, normalizedValue);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Obter estatísticas do usuário
  const getUserStats = useCallback(async () => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.getUserStats(user.id);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter estatísticas';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Reiniciar dia de trabalho
  const restartWorkDay = useCallback(async () => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.restartWorkDay(user.id);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao reiniciar dia';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Obter conferências ativas
  const getActiveConferences = useCallback(async () => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.getActiveConferences(user.id);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter conferências';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Obter histórico de não encontrados
  const getNotFoundHistory = useCallback(async () => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.getNotFoundHistory(user.id);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter histórico';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Inserir transações em lote (para quando um arquivo é processado)
  const insertBankingTransactions = useCallback(async (fileId: string, transactions: any[]) => {
    if (!user?.id) {
      setError('Usuário não autenticado');
      return { data: null, error: 'Usuário não autenticado' };
    }

    setLoading(true);
    setError(null);

    try {
      const result = await supabaseApi.insertBankingTransactions(user.id, fileId, transactions);
      if (result.error) {
        setError(result.error.message);
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao inserir transações';
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    // Estados
    loading,
    error,
    clearError,

    // Funções
    searchTransactionsByValue,
    transferToConference,
    removeFromConference,
    registerNotFound,
    getUserStats,
    restartWorkDay,
    getActiveConferences,
    getNotFoundHistory,
    insertBankingTransactions,

    // Informações do usuário
    user,
    isAuthenticated: !!user?.id
  };
};
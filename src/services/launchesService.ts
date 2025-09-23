import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { dbLogger as logger } from '../utils/logger';

export interface Launch {
  id?: string;
  user_id?: string;
  launch_date: string; // YYYY-MM-DD format
  payment_type: string;
  is_link?: boolean;
  value: number;
  credit_1x?: number;
  credit_2x?: number;
  credit_3x?: number;
  credit_4x?: number;
  credit_5x?: number;
  observation?: string;
  is_outgoing?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LaunchesServiceResponse<T = any> {
  data: T | null;
  error: string | null;
  success: boolean;
}

class LaunchesService {
  private readonly TABLE_NAME = 'launches';
  private userCache: { user: any; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 30000; // 30 segundos

  /**
   * Get cached user or fetch from Supabase
   */
  private async getCachedUser() {
    const now = Date.now();

    if (this.userCache && (now - this.userCache.timestamp) < this.CACHE_DURATION) {
      return this.userCache.user;
    }

    const { data: { user } } = await supabase.auth.getUser();
    this.userCache = { user, timestamp: now };
    return user;
  }

  /**
   * Create a new launch
   */
  async createLaunch(launch: Omit<Launch, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<LaunchesServiceResponse<Launch>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      const launchData = {
        ...launch,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert([launchData])
        .select()
        .single();

      if (error) {
        logger.error('Error creating launch:', error);
        toast.error('Erro ao salvar lançamento');
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      toast.success('Lançamento salvo com sucesso');
      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in createLaunch:', error);
      toast.error('Erro ao salvar lançamento');
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Get all launches for the current user
   */
  async getLaunches(dateFilter?: string): Promise<LaunchesServiceResponse<Launch[]>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      let query = supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', user.id);

      // Apply date filter if provided
      if (dateFilter) {
        query = query.eq('launch_date', dateFilter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching launches:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      return {
        data: data || [],
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in getLaunches:', error);
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Update an existing launch
   */
  async updateLaunch(id: string, updates: Partial<Launch>): Promise<LaunchesServiceResponse<Launch>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      // Remove fields that shouldn't be updated
      const { user_id, created_at, ...allowedUpdates } = updates;

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .update(allowedUpdates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating launch:', error);
        toast.error('Erro ao atualizar lançamento');
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      if (!data) {
        return {
          data: null,
          error: 'Lançamento não encontrado ou sem permissão',
          success: false
        };
      }

      toast.success('Lançamento atualizado com sucesso');
      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in updateLaunch:', error);
      toast.error('Erro ao atualizar lançamento');
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Delete a launch
   */
  async deleteLaunch(id: string): Promise<LaunchesServiceResponse<boolean>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error deleting launch:', error);
        toast.error('Erro ao excluir lançamento');
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      toast.success('Lançamento excluído com sucesso');
      return {
        data: true,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in deleteLaunch:', error);
      toast.error('Erro ao excluir lançamento');
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Get launches summary for a specific date
   */
  async getLaunchesSummary(date: string): Promise<LaunchesServiceResponse<{
    total_launches: number;
    total_value: number;
    total_credit_1x: number;
    total_credit_2x: number;
    total_credit_3x: number;
    total_credit_4x: number;
    total_credit_5x: number;
    payment_types: { [key: string]: number };
  }>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .select('*')
        .eq('user_id', user.id)
        .eq('launch_date', date);

      if (error) {
        logger.error('Error fetching launches summary:', error);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      const launches = data || [];

      const summary = {
        total_launches: launches.length,
        total_value: launches.reduce((sum, launch) => sum + (launch.value || 0), 0),
        total_credit_1x: launches.reduce((sum, launch) => sum + (launch.credit_1x || 0), 0),
        total_credit_2x: launches.reduce((sum, launch) => sum + (launch.credit_2x || 0), 0),
        total_credit_3x: launches.reduce((sum, launch) => sum + (launch.credit_3x || 0), 0),
        total_credit_4x: launches.reduce((sum, launch) => sum + (launch.credit_4x || 0), 0),
        total_credit_5x: launches.reduce((sum, launch) => sum + (launch.credit_5x || 0), 0),
        payment_types: launches.reduce((acc, launch) => {
          acc[launch.payment_type] = (acc[launch.payment_type] || 0) + 1;
          return acc;
        }, {} as { [key: string]: number })
      };

      return {
        data: summary,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in getLaunchesSummary:', error);
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Delete all launches for the current user
   */
  async deleteAllLaunches(): Promise<LaunchesServiceResponse<boolean>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      // First, get the count of launches to be deleted
      const { count, error: countError } = await supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) {
        logger.error('Error counting launches:', countError);
        return {
          data: null,
          error: countError.message,
          success: false
        };
      }

      const launchCount = count || 0;

      if (launchCount === 0) {
        toast.info('Nenhum lançamento encontrado para excluir');
        return {
          data: true,
          error: null,
          success: true
        };
      }

      // Delete all launches for the current user
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error deleting all launches:', error);
        toast.error('Erro ao excluir todos os lançamentos');
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      toast.success(`${launchCount} lançamento(s) excluído(s) com sucesso`);
      return {
        data: true,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in deleteAllLaunches:', error);
      toast.error('Erro ao excluir todos os lançamentos');
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Delete all launches for a specific date
   */
  async deleteAllLaunchesByDate(date: string): Promise<LaunchesServiceResponse<boolean>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      // First, get the count of launches to be deleted for this date
      const { count, error: countError } = await supabase
        .from(this.TABLE_NAME)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('launch_date', date);

      if (countError) {
        logger.error('Error counting launches by date:', countError);
        return {
          data: null,
          error: countError.message,
          success: false
        };
      }

      const launchCount = count || 0;

      if (launchCount === 0) {
        toast.info(`Nenhum lançamento encontrado para a data ${date}`);
        return {
          data: true,
          error: null,
          success: true
        };
      }

      // Delete all launches for the specified date
      const { error } = await supabase
        .from(this.TABLE_NAME)
        .delete()
        .eq('user_id', user.id)
        .eq('launch_date', date);

      if (error) {
        logger.error('Error deleting launches by date:', error);
        toast.error(`Erro ao excluir lançamentos da data ${date}`);
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      toast.success(`${launchCount} lançamento(s) da data ${date} excluído(s) com sucesso`);
      return {
        data: true,
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in deleteAllLaunchesByDate:', error);
      toast.error(`Erro ao excluir lançamentos da data ${date}`);
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }

  /**
   * Sync local launches to Supabase
   */
  async syncLocalLaunches(localLaunches: Launch[]): Promise<LaunchesServiceResponse<Launch[]>> {
    try {
      const user = await this.getCachedUser();

      if (!user) {
        return {
          data: null,
          error: 'Usuário não autenticado',
          success: false
        };
      }

      // Prepare launches for sync (remove local-only fields)
      const launchesToSync = localLaunches.map(launch => ({
        launch_date: launch.launch_date,
        payment_type: launch.payment_type,
        is_link: launch.is_link || false,
        value: launch.value,
        credit_1x: launch.credit_1x || 0,
        credit_2x: launch.credit_2x || 0,
        credit_3x: launch.credit_3x || 0,
        credit_4x: launch.credit_4x || 0,
        credit_5x: launch.credit_5x || 0,
        observation: launch.observation,
        is_outgoing: launch.is_outgoing || false,
        user_id: user.id
      }));

      const { data, error } = await supabase
        .from(this.TABLE_NAME)
        .insert(launchesToSync)
        .select();

      if (error) {
        logger.error('Error syncing launches:', error);
        toast.error('Erro ao sincronizar lançamentos');
        return {
          data: null,
          error: error.message,
          success: false
        };
      }

      toast.success(`${data?.length || 0} lançamentos sincronizados com sucesso`);
      return {
        data: data || [],
        error: null,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('Error in syncLocalLaunches:', error);
      toast.error('Erro ao sincronizar lançamentos');
      return {
        data: null,
        error: errorMessage,
        success: false
      };
    }
  }
}

export const launchesService = new LaunchesService();
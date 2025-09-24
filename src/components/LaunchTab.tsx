import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { formatForDisplay } from '../utils/dateFormatter';
import { useDashboardFilters } from '../hooks/usePersistentState';
import { ExportButtons } from './ExportButtons';
import { formSchemas, safeValidate } from '../utils/validationSchemas';
import { ValidationError, useFieldValidation } from './ValidationError';
import { useKeyboardShortcuts, useFocusRestore } from '../hooks/useKeyboardShortcuts';
import { formatCurrency } from '../utils/valueNormalizer';
import { launchesService, Launch as SupabaseLaunch } from '../services/launchesService';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import { logger } from '../utils/logger';

type PaymentMethod =
  | 'credit_1x'
  | 'credit_2x'
  | 'credit_3x'
  | 'credit_4x'
  | 'credit_5x'
  | 'debit'
  | 'cash'
  | 'coins'
  | 'deposit'
  | 'outgoing';

interface Launch {
  id: string;
  date: Date;
  paymentType: string;
  isLink?: boolean;
  value: number;
  credit1x?: number;
  credit2x?: number;
  credit3x?: number;
  credit4x?: number;
  credit5x?: number;
  timestamp: Date;
  observation?: string; // Campo observação para saídas
  needsSync?: boolean; // Indica se precisa ser sincronizado com Supabase
}

interface ConferenceItem {
  id: string;
  date: string;
  description: string;
  value: number;
  originalHistory: string;
  source: string;
  cpf: string;
  conferredAt: Date;
  conferredId: string;
  remove?: boolean;
  observation?: string; // Campo observação para saídas
}

interface LaunchTabProps {
  currentDate: Date;
  operationDate: string; // DD/MM/YYYY format from global state
  onLaunchAdded: (launch: ConferenceItem) => void; // Callback when a launch is added
  conferredItems: ConferenceItem[]; // To check for duplicates
}

const STORAGE_KEY = 'dashboard_launches';

const loadLaunches = (): Launch[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Launch[];
      return parsed.map((item) => {
        let date = new Date();
        let timestamp = new Date();

        try {
          if (item.date) {
            const parsed = new Date(item.date);
            if (!isNaN(parsed.getTime())) {
              date = parsed;
            } else {
              logger.warn('Invalid date value:', item.date, 'using current date as fallback');
              date = new Date();
            }
          }
        } catch {
          logger.warn('Invalid date value:', item.date, 'using current date as fallback');
          date = new Date();
        }

        try {
          if (item.timestamp) {
            const parsed = new Date(item.timestamp);
            if (!isNaN(parsed.getTime())) {
              timestamp = parsed;
            } else {
              logger.warn('Invalid timestamp value:', item.timestamp, 'using current time as fallback');
              timestamp = new Date();
            }
          }
        } catch {
          logger.warn('Invalid timestamp value:', item.timestamp, 'using current time as fallback');
          timestamp = new Date();
        }

        return {
          ...item,
          date,
          timestamp,
        };
      });
    }
  } catch (error) {
    logger.error('Error loading launches:', error);
  }
  return [];
};

const saveLaunches = (launches: Launch[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(launches));
  } catch (error) {
    logger.error('Error saving launches:', error);
  }
};

export const LaunchTab: React.FC<LaunchTabProps> = ({ currentDate, operationDate, onLaunchAdded, conferredItems }) => {
  const [dashboardFilters, setDashboardFilters] = useDashboardFilters();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLink, setIsLink] = useState<boolean | null>(null);
  const [value, setValue] = useState('');
  const [observation, setObservation] = useState('');
  const [launches, setLaunches] = useState<Launch[]>(loadLaunches);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'date' | 'value'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterMessage, setFilterMessage] = useState<string | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentMethod | 'all'>('all');
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [launchToUndo, setLaunchToUndo] = useState<Launch | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'all' | 'date'>('all');

  const valueInputRef = useRef<HTMLInputElement>(null);
  const { saveFocus, restoreFocus } = useFocusRestore();

  // Debounce value validation to improve performance
  const debouncedValue = useDebounce(value, 300); // 300ms delay

  // Helper function to validate dates
  const isValidDate = (date: any): date is Date => {
    return date instanceof Date && !isNaN(date.getTime());
  };


  // Load launches from Supabase on component mount and when filter date changes
  // Moved after loadLaunchesFromSupabase definition to avoid reference error

  // Define getFilterDate early to avoid initialization errors
  const getFilterDate = useCallback(() => {
    // Use global filter date if set, otherwise use operation date
    if (dashboardFilters.selectedDate) {
      try {
        const [year, month, day] = dashboardFilters.selectedDate.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (error) {
        logger.warn('Invalid selectedDate format:', dashboardFilters.selectedDate);
      }
    }

    // Parse operation date (DD/MM/YYYY format)
    if (operationDate) {
      try {
        const [day, month, year] = operationDate.split('/');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (error) {
        logger.warn('Invalid operationDate format:', operationDate);
      }
    }

    // Fallback to current date and ensure it's valid
    if (!currentDate || isNaN(currentDate.getTime())) {
      logger.warn('Invalid currentDate, using today as fallback');
      return new Date();
    }

    return currentDate;
  }, [dashboardFilters.selectedDate, operationDate, currentDate]);

  const paymentMethods = useMemo(() => [
    { id: 'credit_1x' as PaymentMethod, label: 'Cartão de Crédito 1x', group: 'credit' },
    { id: 'credit_2x' as PaymentMethod, label: 'Cartão de Crédito 2x', group: 'credit' },
    { id: 'credit_3x' as PaymentMethod, label: 'Cartão de Crédito 3x', group: 'credit' },
    { id: 'credit_4x' as PaymentMethod, label: 'Cartão de Crédito 4x', group: 'credit' },
    { id: 'credit_5x' as PaymentMethod, label: 'Cartão de Crédito 5x', group: 'credit' },
    { id: 'debit' as PaymentMethod, label: 'Débito', group: 'other' },
    { id: 'cash' as PaymentMethod, label: 'Dinheiro', group: 'other' },
    { id: 'coins' as PaymentMethod, label: 'Moedas', group: 'other' },
    { id: 'deposit' as PaymentMethod, label: 'Depósito', group: 'other' },
    { id: 'outgoing' as PaymentMethod, label: 'Saída', group: 'outgoing' },
  ], []);

  // Load launches from Supabase
  const loadLaunchesFromSupabase = useCallback(async () => {
    setIsLoading(true);
    try {
      const filterDate = getFilterDate();
      const dateString = filterDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const response = await launchesService.getLaunches(dateString);

      if (response.success && response.data) {
        // Convert Supabase format to local format
        const supabaseLaunches = response.data.map((launch: SupabaseLaunch): Launch => ({
          id: launch.id || '',
          date: new Date(launch.launch_date),
          paymentType: launch.payment_type,
          isLink: launch.is_link,
          value: launch.value,
          credit1x: launch.credit_1x,
          credit2x: launch.credit_2x,
          credit3x: launch.credit_3x,
          credit4x: launch.credit_4x,
          credit5x: launch.credit_5x,
          timestamp: new Date(launch.created_at || Date.now()),
          observation: launch.observation,
        }));

        setLaunches(supabaseLaunches);
        setLastSyncTime(new Date());
      } else {
        // If no data from Supabase, load from localStorage as fallback
        const localData = loadLaunches();
        if (localData.length > 0) {
          setLaunches(localData);
          logger.debug('Using local data as fallback');
        }
      }
    } catch (error) {
      logger.error('Error loading launches from Supabase:', error);
      // Don't show error toast on initial load - just use local data
      // toast.error('Erro ao carregar lançamentos do servidor');

      // Load from localStorage as fallback
      const localData = loadLaunches();
      if (localData.length > 0) {
        setLaunches(localData);
        logger.debug('Using local data due to Supabase error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getFilterDate]);

  // Delete all launches
  const handleDeleteAllLaunches = useCallback(async () => {
    setIsDeleting(true);
    try {
      const response = await launchesService.deleteAllLaunches();

      if (response.success) {
        // Clear local state
        setLaunches([]);
        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
        // Reload from Supabase
        await loadLaunchesFromSupabase();
        setShowDeleteModal(false);
      }
    } catch (error) {
      logger.error('Error deleting all launches:', error);
      toast.error('Erro ao excluir todos os lançamentos');
    } finally {
      setIsDeleting(false);
    }
  }, [loadLaunchesFromSupabase]);

  // Delete launches by date
  const handleDeleteLaunchesByDate = useCallback(async () => {
    setIsDeleting(true);
    try {
      const filterDate = getFilterDate();
      const dateString = filterDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const response = await launchesService.deleteAllLaunchesByDate(dateString);

      if (response.success) {
        // Clear local state
        setLaunches([]);
        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
        // Reload from Supabase
        await loadLaunchesFromSupabase();
        setShowDeleteModal(false);
      }
    } catch (error) {
      logger.error('Error deleting launches by date:', error);
      toast.error('Erro ao excluir lançamentos da data');
    } finally {
      setIsDeleting(false);
    }
  }, [getFilterDate, loadLaunchesFromSupabase]);

  // Show delete confirmation modal
  const showDeleteConfirmation = useCallback((type: 'all' | 'date') => {
    setDeleteType(type);
    setShowDeleteModal(true);
  }, []);

  // Handle delete confirmation
  const handleConfirmDelete = useCallback(async () => {
    if (deleteType === 'all') {
      await handleDeleteAllLaunches();
    } else {
      await handleDeleteLaunchesByDate();
    }
  }, [deleteType, handleDeleteAllLaunches, handleDeleteLaunchesByDate]);


  // Load launches when component mounts or filter date changes
  useEffect(() => {
    loadLaunchesFromSupabase();
  }, [loadLaunchesFromSupabase]);


  // Debounced validation effect
  useEffect(() => {
    if (debouncedValue.trim()) {
      const validation = safeValidate(formSchemas.conferenceValue, { value: debouncedValue });
      if (!validation.success) {
        setError(validation.error);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }, [debouncedValue]);

  // Using the centralized formatCurrency function from valueNormalizer

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setValue(input);
    // Validation is now handled by debounced effect above
  };

  const handleAddLaunch = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (!selectedMethod) {
      setError('Selecione um método de pagamento');
      return;
    }

    if (selectedMethod.startsWith('credit') && isLink === null) {
      setError('Informe se é link (Sim/Não)');
      return;
    }

    if (selectedMethod === 'outgoing' && !observation.trim()) {
      setError('Observação é obrigatória para saídas');
      return;
    }

    // Validate value using Zod
    const valueValidation = safeValidate(formSchemas.conferenceValue, { value });
    if (!valueValidation.success) {
      setError(valueValidation.error);
      return;
    }

    const baseNumericValue = valueValidation.data.value;
    // Para saídas, converter para valor negativo
    const numericValue = selectedMethod === 'outgoing' ? -Math.abs(baseNumericValue) : baseNumericValue;

    const paymentTypeLabel = paymentMethods.find(m => m.id === selectedMethod)?.label || '';
    const linkStatus = selectedMethod.startsWith('credit') && isLink !== null
      ? ` / Link: ${isLink ? 'Sim' : 'Não'}`
      : '';

    const filterDate = getFilterDate();

    // Create local launch object immediately
    const localLaunch: Launch = {
      id: `launch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: filterDate,
      paymentType: `${paymentTypeLabel}${linkStatus}`,
      isLink: selectedMethod.startsWith('credit') ? isLink || false : undefined,
      value: numericValue,
      timestamp: new Date(),
      observation: selectedMethod === 'outgoing' ? observation.trim() : undefined,
    };

    // Para cartões de crédito, usar sempre valor positivo nas parcelas específicas
    const creditValue = Math.abs(numericValue);
    if (selectedMethod === 'credit_1x') localLaunch.credit1x = creditValue;
    if (selectedMethod === 'credit_2x') localLaunch.credit2x = creditValue;
    if (selectedMethod === 'credit_3x') localLaunch.credit3x = creditValue;
    if (selectedMethod === 'credit_4x') localLaunch.credit4x = creditValue;
    if (selectedMethod === 'credit_5x') localLaunch.credit5x = creditValue;

    // Prepare launch data for Supabase
    const launchData: SupabaseLaunch = {
      launch_date: filterDate.toISOString().split('T')[0],
      payment_type: `${paymentTypeLabel}${linkStatus}`,
      is_link: selectedMethod.startsWith('credit') ? isLink || false : false,
      value: numericValue,
      credit_1x: selectedMethod === 'credit_1x' ? Math.abs(numericValue) : 0,
      credit_2x: selectedMethod === 'credit_2x' ? Math.abs(numericValue) : 0,
      credit_3x: selectedMethod === 'credit_3x' ? Math.abs(numericValue) : 0,
      credit_4x: selectedMethod === 'credit_4x' ? Math.abs(numericValue) : 0,
      credit_5x: selectedMethod === 'credit_5x' ? Math.abs(numericValue) : 0,
      observation: selectedMethod === 'outgoing' ? observation.trim() : undefined,
      is_outgoing: selectedMethod === 'outgoing',
    };

    // Add to state and save locally immediately for better UX
    const updatedLaunches = [localLaunch, ...launches];
    setLaunches(updatedLaunches);
    saveLaunches(updatedLaunches);

    // Prepare conference item for Conferência de Caixa
    const conferenceItem = {
      id: localLaunch.id,
      date: formatForDisplay(localLaunch.date),
      description: localLaunch.paymentType,
      value: localLaunch.value,
      originalHistory: 'Manual',
      source: 'manual',
      cpf: '',
      conferredAt: localLaunch.date,
      conferredId: localLaunch.id,
      observation: localLaunch.observation
    };

    // Check for duplicates before adding
    const isDuplicate = conferredItems.some(item => item.conferredId === localLaunch.id);
    let conferenceItemSent = false;

    // Don't send to conference here - wait for Supabase response
    // This prevents duplicate entries

    // Try to save to Supabase in background
    setIsSyncing(true);
    try {
      const response = await launchesService.createLaunch(launchData);

      if (response.success && response.data) {
        // Update the local launch with the Supabase ID
        const updatedLaunch: Launch = {
          ...localLaunch,
          id: response.data.id || localLaunch.id,
          timestamp: new Date(response.data.created_at || Date.now()),
        };

        // Update the launch in state with Supabase ID
        const finalLaunches = updatedLaunches.map(l =>
          l.id === localLaunch.id ? updatedLaunch : l
        );
        setLaunches(finalLaunches);
        saveLaunches(finalLaunches);

        // Send to conference with Supabase ID (only if not duplicate)
        if (response.data.id && !isDuplicate) {
          onLaunchAdded({
            ...conferenceItem,
            id: response.data.id,
            conferredId: response.data.id
          });
          conferenceItemSent = true;
        }

        setSuccess('✅ Lançamento salvo no Supabase e enviado para Conferência de Caixa');
        toast.success('Lançamento sincronizado com sucesso');
      } else {
        throw new Error(response.error || 'Erro ao salvar no Supabase');
      }
    } catch (error) {
      logger.error('Error saving launch to Supabase:', error);
      // Keep local data and mark for later sync
      const pendingLaunch = { ...localLaunch, needsSync: true };
      const finalLaunches = updatedLaunches.map(l =>
        l.id === localLaunch.id ? pendingLaunch : l
      );
      setLaunches(finalLaunches);
      saveLaunches(finalLaunches);

      setSuccess('📱 Lançamento salvo localmente - será sincronizado automaticamente');
      toast.warning('Erro ao conectar com servidor. Dados salvos localmente.');

      // Set error message for user
      setError('💾 Offline: Lançamento salvo localmente. Sincronizará automaticamente quando conectar.');

      // Send to conference only if not already sent (for offline case)
      if (!conferenceItemSent && !isDuplicate) {
        onLaunchAdded(conferenceItem);
        conferenceItemSent = true;
      }
    } finally {
      setIsSyncing(false);
    }

    setValue('');
    setObservation('');

    if (valueInputRef.current) {
      valueInputRef.current.focus();
    }

    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 5000);
  }, [selectedMethod, isLink, value, observation, getFilterDate, launches, conferredItems, onLaunchAdded, paymentMethods]);

  const handleClearFilters = useCallback(() => {
    setPaymentTypeFilter('all');
    setDashboardFilters(prev => ({ ...prev, selectedDate: '' }));
    setFilterMessage('Todos os filtros foram removidos');
    setTimeout(() => setFilterMessage(null), 3000);

    // Keep focus on value input
    if (valueInputRef.current) {
      valueInputRef.current.focus();
    }
  }, [setDashboardFilters]);

  const handlePaymentTypeFilterChange = useCallback((newFilter: PaymentMethod | 'all') => {
    setPaymentTypeFilter(newFilter);

    // Update filter message
    if (newFilter === 'all') {
      setFilterMessage('Exibindo todos os tipos de pagamento');
    } else {
      const method = paymentMethods.find(m => m.id === newFilter);
      setFilterMessage(`Filtrado por: ${method?.label || newFilter}`);
    }

    setTimeout(() => setFilterMessage(null), 3000);

    // Keep focus on value input
    if (valueInputRef.current) {
      valueInputRef.current.focus();
    }
  }, [paymentMethods]);

  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setError(null);

    if (!method.startsWith('credit')) {
      setIsLink(null);
    }

    if (method !== 'outgoing') {
      setObservation('');
    }
  };

  const handleSort = (field: 'date' | 'value') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleUndoClick = (launch: Launch) => {
    setLaunchToUndo(launch);
    setShowUndoModal(true);
  };

  const handleConfirmUndo = async () => {
    if (!launchToUndo) return;

    setIsSyncing(true);
    try {
      // Delete from Supabase first
      const response = await launchesService.deleteLaunch(launchToUndo.id);

      if (response.success) {
        // Remove from local state
        const updatedLaunches = launches.filter(l => l.id !== launchToUndo.id);
        setLaunches(updatedLaunches);
        saveLaunches(updatedLaunches);

        // Notify parent to remove from Conferência de Caixa
        if (onLaunchAdded) {
          // Send a removal signal (negative value or special flag)
          onLaunchAdded({
            id: launchToUndo.id,
            conferredId: launchToUndo.id,
            remove: true
          } as ConferenceItem);
        }

        setSuccess('Lançamento desfeito com sucesso');
        toast.success('Lançamento removido do banco de dados');
      } else {
        // Fallback: remove only locally if Supabase fails
        const updatedLaunches = launches.filter(l => l.id !== launchToUndo.id);
        setLaunches(updatedLaunches);
        saveLaunches(updatedLaunches);

        setSuccess('Lançamento removido localmente');
        toast.warning('Erro ao remover do servidor. Removido apenas localmente.');
      }
    } catch (error) {
      logger.error('Error in handleConfirmUndo:', error);
      // Fallback: remove only locally
      const updatedLaunches = launches.filter(l => l.id !== launchToUndo.id);
      setLaunches(updatedLaunches);
      saveLaunches(updatedLaunches);

      setSuccess('Lançamento removido localmente');
      toast.error('Erro ao remover do servidor. Removido apenas localmente.');
    } finally {
      setIsSyncing(false);
      setShowUndoModal(false);
      setLaunchToUndo(null);

      // Return focus to input
      if (valueInputRef.current) {
        valueInputRef.current.focus();
      }

      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleCancelUndo = () => {
    setShowUndoModal(false);
    setLaunchToUndo(null);
  };

  const sortedLaunches = [...launches].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    if (sortField === 'date') {
      return (a.timestamp.getTime() - b.timestamp.getTime()) * multiplier;
    } else {
      return (a.value - b.value) * multiplier;
    }
  });

  const filterDate = getFilterDate();
  const filteredLaunches = sortedLaunches.filter(launch => {
    // Filter by date - normalize to YYYY-MM-DD for comparison
    // Validate dates before calling toISOString to prevent Invalid time value error
    if (!isValidDate(launch.date)) {
      logger.warn('Invalid launch date found:', launch.date, 'for launch:', launch.id);
      return false; // Skip launches with invalid dates
    }

    if (!isValidDate(filterDate)) {
      logger.warn('Invalid filter date:', filterDate);
      return false;
    }

    const launchDateStr = launch.date.toISOString().split('T')[0];
    const filterDateStr = filterDate.toISOString().split('T')[0];
    const dateMatches = launchDateStr === filterDateStr;

    // Filter by payment type
    let typeMatches = true;
    if (paymentTypeFilter !== 'all') {
      // Convert launch payment type to match our filter format
      const launchPaymentType = launch.paymentType.toLowerCase().replace(/\s+/g, '_');
      const filterType = paymentTypeFilter.toString();

      // Handle credit card matches
      if (filterType.startsWith('credit_')) {
        typeMatches = launchPaymentType.includes('crédito') || launchPaymentType.includes('credito');

        // Check specific credit installment if available
        const installmentMatch = filterType.match(/credit_(\d+)x/);
        if (installmentMatch) {
          const installments = installmentMatch[1];
          typeMatches = typeMatches && launchPaymentType.includes(`${installments}x`);
        }
      } else if (filterType === 'debit') {
        typeMatches = launchPaymentType.includes('débito') || launchPaymentType.includes('debito');
      } else if (filterType === 'cash') {
        typeMatches = launchPaymentType.includes('dinheiro');
      } else if (filterType === 'coins') {
        typeMatches = launchPaymentType.includes('moedas');
      } else if (filterType === 'deposit') {
        typeMatches = launchPaymentType.includes('depósito') || launchPaymentType.includes('deposito');
      } else if (filterType === 'outgoing') {
        typeMatches = launchPaymentType.includes('saída') || launchPaymentType.includes('saida');
      }
    }

    return dateMatches && typeMatches;
  });


  const totals = {
    general: filteredLaunches.reduce((sum, item) => sum + item.value, 0),
    credit1x: filteredLaunches.reduce((sum, item) => sum + (item.credit1x || 0), 0),
    credit2x: filteredLaunches.reduce((sum, item) => sum + (item.credit2x || 0), 0),
    credit3x: filteredLaunches.reduce((sum, item) => sum + (item.credit3x || 0), 0),
    credit4x: filteredLaunches.reduce((sum, item) => sum + (item.credit4x || 0), 0),
    credit5x: filteredLaunches.reduce((sum, item) => sum + (item.credit5x || 0), 0),
  };

  // LaunchTab-specific keyboard shortcuts
  const launchShortcuts = [
    {
      key: 'l',
      ctrlKey: true,
      action: () => {
        if (valueInputRef.current) {
          valueInputRef.current.focus();
          valueInputRef.current.select();
        }
      },
      description: 'Focar no campo de valor (Ctrl+L)'
    },
    {
      key: 'Escape',
      action: () => {
        if (showUndoModal) {
          handleCancelUndo();
        }
      },
      description: 'Fechar modal de desfazer (Esc)'
    }
  ];

  useKeyboardShortcuts(launchShortcuts, true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && valueInputRef.current === document.activeElement) {
        handleAddLaunch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleAddLaunch]);

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {/* Left Sidebar - Fixed */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 flex-shrink-0 h-[calc(100vh-8rem)] overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Payment Method Selection */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-100 mb-3">
              Selecionar Pagamento
            </h3>

            {/* Credit Cards Group */}
            <div className="space-y-2 mb-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Cartão de Crédito</p>
              {paymentMethods.filter(m => m.group === 'credit').map(method => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className={`w-full text-left px-3 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
                    selectedMethod === method.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-100'
                  }`}
                  aria-label={method.label}
                >
                  {method.label}
                </button>
              ))}

              {/* Link Option for Credit */}
              {selectedMethod?.startsWith('credit') && (
                <div className="pl-3 space-y-2 mt-2">
                  <p className="text-xs text-gray-400">É link?</p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setIsLink(true)}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors min-h-[36px] ${
                        isLink === true
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setIsLink(false)}
                      className={`flex-1 px-3 py-2 text-xs rounded-md transition-colors min-h-[36px] ${
                        isLink === false
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Other Payment Methods */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Outros Métodos</p>
              {paymentMethods.filter(m => m.group === 'other').map(method => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className={`w-full text-left px-3 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
                    selectedMethod === method.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-gray-100'
                  }`}
                  aria-label={method.label}
                >
                  {method.label}
                </button>
              ))}
            </div>

            {/* Outgoing (Saída) */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider">Saídas</p>
              {paymentMethods.filter(m => m.group === 'outgoing').map(method => (
                <button
                  key={method.id}
                  onClick={() => handleMethodSelect(method.id)}
                  className={`w-full text-left px-3 py-3 text-sm rounded-md transition-colors min-h-[44px] ${
                    selectedMethod === method.id
                      ? 'bg-red-600 text-white'
                      : 'bg-red-900/20 text-red-300 border border-red-600 hover:bg-red-900/30 hover:text-red-200'
                  }`}
                  aria-label={method.label}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Value Input */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-100 mb-3">
              Preencher Valor
            </h3>
            <div className="space-y-2">
              <input
                id="launch-value-input"
                ref={valueInputRef}
                type="text"
                placeholder="Digite o valor (ex: 123,45)"
                value={value}
                onChange={handleValueChange}
                {...useFieldValidation('launch-value-input', error)}
                className={`w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border rounded-md focus:ring-2 ${
                  error
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-600 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                aria-label="Valor do lançamento"
              />
              <ValidationError error={error} fieldId="launch-value-input" />

              {/* Observation Field for Outgoing */}
              {selectedMethod === 'outgoing' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider">
                    Observação *
                  </label>
                  <input
                    id="launch-observation-input"
                    type="text"
                    placeholder="Digite o motivo da saída (ex: Serviço X)"
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    aria-label="Observação da saída"
                  />
                </div>
              )}

              <button
                onClick={handleAddLaunch}
                disabled={!selectedMethod || !value || (selectedMethod === 'outgoing' && !observation.trim())}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <span>Adicionar</span>
              </button>
            </div>

            {/* Success Message - Melhorado para melhor visibilidade */}
            {success && (
              <div className="mt-2 p-3 bg-green-900/30 border-2 border-green-400 rounded-lg shadow-lg animate-pulse">
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm font-medium text-green-300">{success}</p>
                </div>
              </div>
            )}
          </div>

          {/* Date Filter Block */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-gray-100 mb-3">
              Filtrar por Data
            </h3>
            <div className="space-y-2">
              <div className="bg-gray-900 rounded p-2 border border-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Data atual:</span>
                  <span className="text-sm text-indigo-400 font-medium">
                    {formatForDisplay(filterDate)}
                  </span>
                </div>
              </div>

              <input
                type="date"
                value={dashboardFilters.selectedDate}
                onChange={(e) => setDashboardFilters(prev => ({ ...prev, selectedDate: e.target.value }))}
                className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Selecionar data para filtro"
              />

              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setFilterMessage('Filtro aplicado');
                    setTimeout(() => setFilterMessage(null), 2000);
                    if (valueInputRef.current) valueInputRef.current.focus();
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Aplicar
                </button>
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setDashboardFilters(prev => ({ ...prev, selectedDate: today }));
                    setFilterMessage('Data de hoje selecionada');
                    setTimeout(() => setFilterMessage(null), 2000);
                    if (valueInputRef.current) valueInputRef.current.focus();
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    setDashboardFilters(prev => ({ ...prev, selectedDate: '' }));
                    setFilterMessage('Filtro limpo');
                    setTimeout(() => setFilterMessage(null), 2000);
                    if (valueInputRef.current) valueInputRef.current.focus();
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Limpar
                </button>
              </div>

              {filterMessage && (
                <div className="p-2 bg-indigo-900/20 border border-indigo-400 rounded-md">
                  <p className="text-xs text-indigo-400">{filterMessage}</p>
                </div>
              )}

              {filteredLaunches.length === 0 && launches.length > 0 && (
                <div className="p-2 bg-yellow-900/20 border border-yellow-400 rounded-md">
                  <p className="text-xs text-yellow-400">
                    Nenhum lançamento encontrado para {formatForDisplay(filterDate)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Table */}
      <main className="flex-1 bg-gray-950 min-w-0 h-[calc(100vh-8rem)] flex flex-col">
        <div className="bg-gray-800 shadow-2xl border border-gray-700 flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Lançamentos Manuais</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {filteredLaunches.length} lançamento(s) para {formatForDisplay(filterDate)}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={loadLaunchesFromSupabase}
                  disabled={isLoading}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-1"
                  title="Carregar do Supabase"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Carregando</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Carregar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => showDeleteConfirmation('date')}
                  disabled={isDeleting || filteredLaunches.length === 0}
                  className="px-3 py-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-1"
                  title="Excluir todos os lançamentos da data atual"
                >
                  {isDeleting && deleteType === 'date' ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Excluindo</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Limpar Data</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => showDeleteConfirmation('all')}
                  disabled={isDeleting || launches.length === 0}
                  className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-1"
                  title="Excluir TODOS os lançamentos"
                >
                  {isDeleting && deleteType === 'all' ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Excluindo</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Limpar Tudo</span>
                    </>
                  )}
                </button>
              </div>
              <ExportButtons
                data={{
                  manual: filteredLaunches.map(launch => ({
                    day: operationDate,
                    document_number: '',
                    description: `${launch.paymentType} - Lançamento manual`,
                    value: launch.value,
                    entry_type: launch.value >= 0 ? 'income' : 'expense',
                    category: launch.paymentType,
                    status: 'active',
                    source_id: `manual_${launch.id}`
                  }))
                }}
                prefix="lancamentos"
                date={operationDate}
                disabled={filteredLaunches.length === 0}
              />
            </div>
          </div>

          {/* Payment Type Filter Block */}
          <div className="bg-gray-800 border-b border-gray-700 p-3">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1">Filtrar por Tipo de Pagamento</label>
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => handlePaymentTypeFilterChange(e.target.value as PaymentMethod | 'all')}
                  className="w-full px-3 py-2 text-sm text-gray-100 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">Todos</option>
                  <option value="credit_1x">Crédito 1x</option>
                  <option value="credit_2x">Crédito 2x</option>
                  <option value="credit_3x">Crédito 3x</option>
                  <option value="credit_4x">Crédito 4x</option>
                  <option value="credit_5x">Crédito 5x</option>
                  <option value="debit">Débito</option>
                  <option value="cash">Dinheiro</option>
                  <option value="coins">Moedas</option>
                  <option value="deposit">Depósito</option>
                  <option value="outgoing">Saída</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            </div>

          </div>

          <div className="flex-1 overflow-auto min-h-0" style={{ height: 'calc(100vh - 200px)' }}>
            {/* Wrapper para scroll horizontal em mobile */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300 min-w-[800px] lg:min-w-0" style={{ height: '100%', tableLayout: 'fixed' }}>
              <thead className="text-xs text-gray-400 uppercase bg-gray-900 sticky top-0">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      Data
                      <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"/>
                      </svg>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3">Tipo de Pagamento</th>
                  <th scope="col" className="px-6 py-3 text-right">Crédito 1x</th>
                  <th scope="col" className="px-6 py-3 text-right">Crédito 2x</th>
                  <th scope="col" className="px-6 py-3 text-right">Crédito 3x</th>
                  <th scope="col" className="px-6 py-3 text-right">Crédito 4x</th>
                  <th scope="col" className="px-6 py-3 text-right">Crédito 5x</th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right cursor-pointer hover:bg-gray-800"
                    onClick={() => handleSort('value')}
                  >
                    <div className="flex items-center justify-end">
                      Valor (R$)
                      <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"/>
                      </svg>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3">Observação</th>
                  <th scope="col" className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody style={{ minHeight: 'calc(100vh - 300px)', display: 'table-row-group' }}>
                {filteredLaunches.length === 0 ? (
                  <tr style={{ height: 'calc(100vh - 300px)' }}>
                    <td colSpan={10} className="px-6 py-8 text-center text-gray-500" style={{ verticalAlign: 'middle' }}>
                      Nenhum lançamento registrado para esta data
                    </td>
                  </tr>
                ) : (
                  filteredLaunches.map((launch) => (
                    <tr key={launch.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-750">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatForDisplay(launch.date)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          launch.needsSync
                            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600'
                            : 'bg-gray-700 text-gray-300'
                        }`}>
                          {launch.needsSync && '⏳ '}
                          {launch.paymentType}
                          {launch.needsSync && ' (pendente)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {launch.credit1x ? formatCurrency(launch.credit1x) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {launch.credit2x ? formatCurrency(launch.credit2x) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {launch.credit3x ? formatCurrency(launch.credit3x) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {launch.credit4x ? formatCurrency(launch.credit4x) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {launch.credit5x ? formatCurrency(launch.credit5x) : '-'}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono ${launch.value < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {formatCurrency(launch.value)}
                      </td>
                      <td className="px-6 py-4">
                        {launch.observation ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/20 text-yellow-300 border border-yellow-600">
                            {launch.observation}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleUndoClick(launch)}
                          className="px-2 py-1 text-xs font-medium text-red-300 bg-red-900/20 border border-red-600 rounded hover:bg-red-900/30 transition-colors"
                          aria-label="Desfazer lançamento"
                        >
                          Desfazer
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredLaunches.length > 0 && (
                <tfoot className="text-xs text-gray-300 bg-gray-900 border-t-2 border-indigo-500">
                  <tr>
                    <td colSpan={2} className="px-6 py-3 font-semibold">
                      Total Geral
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      {totals.credit1x > 0 ? formatCurrency(totals.credit1x) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      {totals.credit2x > 0 ? formatCurrency(totals.credit2x) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      {totals.credit3x > 0 ? formatCurrency(totals.credit3x) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      {totals.credit4x > 0 ? formatCurrency(totals.credit4x) : '-'}
                    </td>
                    <td className="px-6 py-3 text-right font-mono font-semibold">
                      {totals.credit5x > 0 ? formatCurrency(totals.credit5x) : '-'}
                    </td>
                    <td className={`px-6 py-3 text-right font-mono font-semibold ${totals.general < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {formatCurrency(totals.general)}
                    </td>
                    <td className="px-6 py-3"></td>
                    <td className="px-6 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </div>
      </main>

      {/* Undo Confirmation Modal */}
      {showUndoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  Confirmar Desfazer
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  Tem certeza que deseja desfazer este lançamento? Ele será removido de todas as abas.
                </p>
                {launchToUndo && (
                  <div className="bg-gray-900 rounded p-3 mb-4 border border-gray-700">
                    <div className="text-xs text-gray-400">
                      <p>Tipo: {launchToUndo.paymentType}</p>
                      <p>Valor: {formatCurrency(launchToUndo.value)}</p>
                      <p>Data: {formatForDisplay(launchToUndo.date)}</p>
                      {launchToUndo.observation && (
                        <p>Observação: {launchToUndo.observation}</p>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmUndo}
                    disabled={false}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Removendo...
                      </div>
                    ) : (
                      'Confirmar'
                    )}
                  </button>
                  <button
                    onClick={handleCancelUndo}
                    disabled={false}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6 max-w-md w-full mx-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  Confirmar Exclusão
                </h3>
                <p className="text-sm text-gray-300 mb-6">
                  {deleteType === 'all'
                    ? 'Tem certeza que deseja excluir TODOS os lançamentos? Esta ação não pode ser desfeita.'
                    : `Tem certeza que deseja excluir todos os lançamentos da data ${formatForDisplay(getFilterDate())}? Esta ação não pode ser desfeita.`
                  }
                </p>
                <div className="bg-gray-900 rounded p-3 mb-4 border border-gray-700">
                  <div className="text-xs text-gray-400">
                    {deleteType === 'all' ? (
                      <>
                        <p>⚠️ Isso irá excluir TODOS os lançamentos do banco de dados</p>
                        <p>Total de lançamentos: {launches.length}</p>
                      </>
                    ) : (
                      <>
                        <p>⚠️ Isso irá excluir todos os lançamentos da data selecionada</p>
                        <p>Data: {formatForDisplay(getFilterDate())}</p>
                        <p>Lançamentos na data: {filteredLaunches.length}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Excluindo...
                      </div>
                    ) : (
                      'Confirmar Exclusão'
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={isDeleting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
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
            }
          }
        } catch {
          console.warn('Invalid date value:', item.date);
        }

        try {
          if (item.timestamp) {
            const parsed = new Date(item.timestamp);
            if (!isNaN(parsed.getTime())) {
              timestamp = parsed;
            }
          }
        } catch {
          console.warn('Invalid timestamp value:', item.timestamp);
        }

        return {
          ...item,
          date,
          timestamp,
        };
      });
    }
  } catch (error) {
    console.error('Error loading launches:', error);
  }
  return [];
};

const saveLaunches = (launches: Launch[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(launches));
  } catch (error) {
    console.error('Error saving launches:', error);
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

  // Supabase sync states
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'all' | 'date'>('all');

  const valueInputRef = useRef<HTMLInputElement>(null);
  const { saveFocus, restoreFocus } = useFocusRestore();

  // Load launches from Supabase on component mount and when filter date changes
  // Moved after loadLaunchesFromSupabase definition to avoid reference error

  // Define getFilterDate early to avoid initialization errors
  const getFilterDate = useCallback(() => {
    // Use global filter date if set, otherwise use operation date
    if (dashboardFilters.selectedDate) {
      const [year, month, day] = dashboardFilters.selectedDate.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Parse operation date (DD/MM/YYYY format)
    if (operationDate) {
      const [day, month, year] = operationDate.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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
          console.log('Using local data as fallback');
        }
      }
    } catch (error) {
      console.error('Error loading launches from Supabase:', error);
      // Don't show error toast on initial load - just use local data
      // toast.error('Erro ao carregar lançamentos do servidor');

      // Load from localStorage as fallback
      const localData = loadLaunches();
      if (localData.length > 0) {
        setLaunches(localData);
        console.log('Using local data due to Supabase error');
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
      console.error('Error deleting all launches:', error);
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
      console.error('Error deleting launches by date:', error);
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

  // Sync local launches to Supabase
  const syncToSupabase = useCallback(async () => {
    setIsSyncing(true);
    try {
      const localLaunches = loadLaunches();

      if (localLaunches.length === 0) {
        toast.info('Nenhum lançamento local para sincronizar');
        return;
      }

      // Convert local format to Supabase format
      const launchesToSync: SupabaseLaunch[] = localLaunches.map((launch): SupabaseLaunch => ({
        launch_date: launch.date.toISOString().split('T')[0],
        payment_type: launch.paymentType,
        is_link: launch.isLink,
        value: launch.value,
        credit_1x: launch.credit1x,
        credit_2x: launch.credit2x,
        credit_3x: launch.credit3x,
        credit_4x: launch.credit4x,
        credit_5x: launch.credit5x,
        observation: launch.observation,
        is_outgoing: launch.value < 0,
      }));

      const response = await launchesService.syncLocalLaunches(launchesToSync);

      if (response.success) {
        // Clear local storage after successful sync
        localStorage.removeItem(STORAGE_KEY);
        // Reload from Supabase
        await loadLaunchesFromSupabase();
        setLastSyncTime(new Date());
      }
    } catch (error) {
      console.error('Error syncing to Supabase:', error);
      toast.error('Erro ao sincronizar com o servidor');
    } finally {
      setIsSyncing(false);
    }
  }, [loadLaunchesFromSupabase]);

  // Load launches when component mounts or filter date changes
  useEffect(() => {
    loadLaunchesFromSupabase();
  }, [loadLaunchesFromSupabase]);

  // Using the centralized formatCurrency function from valueNormalizer

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setValue(input);

    // Real-time validation using Zod
    if (input.trim()) {
      const validation = safeValidate(formSchemas.conferenceValue, { value: input });
      if (!validation.success) {
        setError(validation.error);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
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

    // Save to Supabase
    setIsSyncing(true);
    try {
      const response = await launchesService.createLaunch(launchData);

      if (response.success && response.data) {
        // Convert back to local format and add to state
        const newLaunch: Launch = {
          id: response.data.id || '',
          date: new Date(response.data.launch_date),
          paymentType: response.data.payment_type,
          isLink: response.data.is_link,
          value: response.data.value,
          credit1x: response.data.credit_1x,
          credit2x: response.data.credit_2x,
          credit3x: response.data.credit_3x,
          credit4x: response.data.credit_4x,
          credit5x: response.data.credit_5x,
          timestamp: new Date(response.data.created_at || Date.now()),
          observation: response.data.observation,
        };

        // Update state immediately to show in table
        const updatedLaunches = [newLaunch, ...launches];
        setLaunches(updatedLaunches);

        // Send to Conferência de Caixa
        const conferenceItem = {
          id: newLaunch.id,
          date: formatForDisplay(newLaunch.date),
          description: newLaunch.paymentType,
          value: newLaunch.value,
          originalHistory: 'Manual',
          source: 'manual',
          cpf: '',
          conferredAt: newLaunch.date, // Use launch date, not current date
          conferredId: newLaunch.id,
          observation: newLaunch.observation
        };

        // Check for duplicates before adding
        const isDuplicate = conferredItems.some(item => item.conferredId === newLaunch.id);
        if (!isDuplicate) {
          onLaunchAdded(conferenceItem);
          setSuccess('Lançamento criado e enviado para Conferência de Caixa');
        } else {
          setSuccess('Lançamento salvo no Supabase com sucesso');
        }
      } else {
        throw new Error(response.error || 'Erro ao salvar lançamento');
      }
    } catch (error) {
      console.error('Error saving launch:', error);
      // Fallback: save locally if Supabase fails
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

      const updatedLaunches = [localLaunch, ...launches];
      setLaunches(updatedLaunches);
      saveLaunches(updatedLaunches);

      toast.error('Erro ao salvar no servidor. Lançamento salvo localmente.');
      setError('Lançamento salvo localmente. Sincronize quando a conexão for restabelecida.');
    } finally {
      setIsSyncing(false);
    }

    setValue('');
    setObservation('');

    if (valueInputRef.current) {
      valueInputRef.current.focus();
    }

    setTimeout(() => setSuccess(null), 3000);
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

  const handleConfirmUndo = () => {
    if (!launchToUndo) return;

    // Remove from launches
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
      });
    }

    setSuccess('Lançamento desfeito com sucesso');
    setShowUndoModal(false);
    setLaunchToUndo(null);

    // Return focus to input
    if (valueInputRef.current) {
      valueInputRef.current.focus();
    }

    setTimeout(() => setSuccess(null), 3000);
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
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
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
                      className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors ${
                        isLink === true
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setIsLink(false)}
                      className={`flex-1 px-3 py-1 text-xs rounded-md transition-colors ${
                        isLink === false
                          ? 'bg-red-600 text-white'
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
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
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
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
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
                disabled={!selectedMethod || !value || (selectedMethod === 'outgoing' && !observation.trim()) || isSyncing}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                {isSyncing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Adicionar</span>
                )}
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mt-2 p-2 bg-green-900/20 border border-green-400 rounded-md">
                <p className="text-xs text-green-400">{success}</p>
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
                  {lastSyncTime && (
                    <span className="ml-2 text-green-400">
                      • Última sincronização: {lastSyncTime.toLocaleTimeString()}
                    </span>
                  )}
                </p>
              </div>

              {/* Sync Controls */}
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
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
                  onClick={syncToSupabase}
                  disabled={isSyncing || loadLaunches().length === 0}
                  className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-md transition-colors flex items-center space-x-1"
                  title="Sincronizar dados locais para Supabase"
                >
                  {isSyncing ? (
                    <>
                      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Sincronizando</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Sync Local</span>
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
            <table className="w-full text-sm text-left text-gray-300" style={{ height: '100%', tableLayout: 'fixed' }}>
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
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                          {launch.paymentType}
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
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={handleCancelUndo}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors"
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
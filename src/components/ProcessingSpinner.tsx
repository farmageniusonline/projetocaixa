import React from 'react';
import { Loader2, FileSpreadsheet, Zap } from 'lucide-react';

interface ProcessingSpinnerProps {
  message?: string;
  progress?: number;
  stage?: 'parsing' | 'normalizing' | 'indexing' | 'saving';
  show: boolean;
  showStallWarning?: boolean;
  canCancel?: boolean;
  onCancel?: () => void;
}

const STAGE_CONFIG = {
  parsing: {
    icon: FileSpreadsheet,
    message: 'Lendo planilha...',
    color: 'text-blue-400'
  },
  normalizing: {
    icon: Zap,
    message: 'Normalizando dados...',
    color: 'text-yellow-400'
  },
  indexing: {
    icon: Zap,
    message: 'Criando índices...',
    color: 'text-green-400'
  },
  saving: {
    icon: Loader2,
    message: 'Salvando...',
    color: 'text-indigo-400'
  }
};

export function ProcessingSpinner({
  message,
  progress,
  stage = 'parsing',
  show,
  showStallWarning = false,
  canCancel = false,
  onCancel
}: ProcessingSpinnerProps) {
  if (!show) return null;

  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;
  const displayMessage = message || config.message;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 animate-spin">
              <div className="h-12 w-12 border-2 border-gray-600 border-t-transparent rounded-full"></div>
            </div>
            <Icon className={`h-6 w-6 ${config.color} animate-pulse`} />
          </div>
        </div>

        {/* Message */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-200 mb-2">
            Processando...
          </h3>
          <p className="text-gray-400 text-sm">
            {displayMessage}
          </p>
        </div>

        {/* Progress Bar */}
        {typeof progress === 'number' && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Progresso</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Stage Indicators */}
        <div className="flex justify-center space-x-2">
          {Object.entries(STAGE_CONFIG).map(([key, stageConfig], index) => (
            <div
              key={key}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                key === stage
                  ? 'bg-indigo-500 scale-125'
                  : index < Object.keys(STAGE_CONFIG).indexOf(stage)
                  ? 'bg-gray-500'
                  : 'bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Stall Warning */}
        {showStallWarning && (
          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-yellow-400">
                  Processamento mais lento que o esperado...
                </p>
                <p className="text-xs text-yellow-300 mt-1">
                  Isso pode acontecer com arquivos grandes ou complexos
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Button */}
        {canCancel && onCancel && (
          <div className="mt-4">
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 text-sm font-medium text-red-300 bg-red-900/20 border border-red-600 rounded-md hover:bg-red-900/30 transition-colors"
            >
              Cancelar Processamento
            </button>
          </div>
        )}

        {/* Tip */}
        <div className="mt-6 p-3 bg-gray-900 rounded-md">
          <p className="text-xs text-gray-400 text-center">
            💡 Processamento em background para manter a UI responsiva
          </p>
        </div>
      </div>
    </div>
  );
}

// Hook for managing processing state with UX fallbacks
export function useProcessingState() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [stage, setStage] = React.useState<ProcessingSpinnerProps['stage']>('parsing');
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [message, setMessage] = React.useState<string | undefined>(undefined);
  const [lastProgressUpdate, setLastProgressUpdate] = React.useState<number>(0);
  const [showStallWarning, setShowStallWarning] = React.useState(false);
  const [canCancel, setCanCancel] = React.useState(false);

  // Detect stalled progress (no update for >10s)
  React.useEffect(() => {
    if (!isProcessing) {
      setShowStallWarning(false);
      return;
    }

    const checkStall = () => {
      const timeSinceLastUpdate = Date.now() - lastProgressUpdate;
      if (timeSinceLastUpdate > 10000) { // 10 seconds
        setShowStallWarning(true);
        setCanCancel(true);
      }
    };

    const stallTimer = setInterval(checkStall, 2000); // Check every 2s
    return () => clearInterval(stallTimer);
  }, [isProcessing, lastProgressUpdate]);

  const startProcessing = React.useCallback((initialStage: ProcessingSpinnerProps['stage'] = 'parsing') => {
    console.log('🚀 Iniciando processamento...');
    setIsProcessing(true);
    setStage(initialStage);
    setProgress(undefined);
    setMessage(undefined);
    setLastProgressUpdate(Date.now());
    setShowStallWarning(false);
    setCanCancel(false);
  }, []);

  const updateStage = React.useCallback((newStage: ProcessingSpinnerProps['stage'], newMessage?: string) => {
    console.log(`📍 Etapa: ${newStage} - ${newMessage || ''}`);
    setStage(newStage);
    setMessage(newMessage);
    setLastProgressUpdate(Date.now());
    setShowStallWarning(false); // Reset warning on progress
  }, []);

  const updateProgress = React.useCallback((newProgress: number) => {
    console.log(`📊 Progresso: ${newProgress}%`);
    setProgress(newProgress);
    setLastProgressUpdate(Date.now());
    setShowStallWarning(false); // Reset warning on progress
  }, []);

  const stopProcessing = React.useCallback(() => {
    console.log('✅ Processamento finalizado');
    setIsProcessing(false);
    setProgress(undefined);
    setMessage(undefined);
    setShowStallWarning(false);
    setCanCancel(false);
  }, []);

  return {
    isProcessing,
    stage,
    progress,
    message,
    showStallWarning,
    canCancel,
    startProcessing,
    updateStage,
    updateProgress,
    stopProcessing
  };
}
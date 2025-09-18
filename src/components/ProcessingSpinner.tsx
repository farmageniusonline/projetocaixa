import React from 'react';
import { Loader2, FileSpreadsheet, Zap } from 'lucide-react';

interface ProcessingSpinnerProps {
  message?: string;
  progress?: number;
  stage?: 'parsing' | 'normalizing' | 'indexing' | 'saving';
  show: boolean;
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
  show
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

// Hook for managing processing state
export function useProcessingState() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [stage, setStage] = React.useState<ProcessingSpinnerProps['stage']>('parsing');
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [message, setMessage] = React.useState<string | undefined>(undefined);

  const startProcessing = React.useCallback((initialStage: ProcessingSpinnerProps['stage'] = 'parsing') => {
    setIsProcessing(true);
    setStage(initialStage);
    setProgress(undefined);
    setMessage(undefined);
  }, []);

  const updateStage = React.useCallback((newStage: ProcessingSpinnerProps['stage'], newMessage?: string) => {
    setStage(newStage);
    setMessage(newMessage);
  }, []);

  const updateProgress = React.useCallback((newProgress: number) => {
    setProgress(newProgress);
  }, []);

  const stopProcessing = React.useCallback(() => {
    setIsProcessing(false);
    setProgress(undefined);
    setMessage(undefined);
  }, []);

  return {
    isProcessing,
    stage,
    progress,
    message,
    startProcessing,
    updateStage,
    updateProgress,
    stopProcessing
  };
}
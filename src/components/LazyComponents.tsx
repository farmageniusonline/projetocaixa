import React, { lazy, Suspense } from 'react';
import { ProcessingSpinner } from './ProcessingSpinner';

// Loading component for lazy loading
const LazyLoadingFallback = ({ message = 'Carregando componente...' }: { message?: string }) => (
  <div className="flex items-center justify-center min-h-[200px]">
    <ProcessingSpinner message={message} />
  </div>
);

// Lazy load heavy components
export const LazyExportModal = lazy(() =>
  import('./ExportModal').then(module => ({ default: module.ExportModal }))
);

export const LazyReconciliationDashboard = lazy(() =>
  import('./ReconciliationDashboard').then(module => ({ default: module.ReconciliationDashboard }))
);

export const LazyAdvancedFiltersPanel = lazy(() =>
  import('./AdvancedFiltersPanel').then(module => ({ default: module.AdvancedFiltersPanel }))
);

export const LazyBackupPanel = lazy(() =>
  import('./BackupPanel').then(module => ({ default: module.BackupPanel }))
);

export const LazyDevPerformancePanel = lazy(() =>
  import('./DevPerformancePanel').then(module => ({ default: module.DevPerformancePanel }))
);

export const LazyVirtualizedDataTable = lazy(() =>
  import('./VirtualizedDataTable').then(module => ({ default: module.VirtualizedDataTable }))
);

export const LazyHistoryByDate = lazy(() =>
  import('./HistoryByDate').then(module => ({ default: module.HistoryByDate }))
);

// HOC for wrapping lazy components with Suspense
export function withLazyLoading<T extends object>(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<T>>,
  fallbackMessage?: string
) {
  return function WrappedComponent(props: T) {
    return (
      <Suspense fallback={<LazyLoadingFallback message={fallbackMessage} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Pre-configured components ready to use
export const ExportModal = withLazyLoading(LazyExportModal, 'Carregando exportação...');
export const ReconciliationDashboard = withLazyLoading(LazyReconciliationDashboard, 'Carregando reconciliação...');
export const AdvancedFiltersPanel = withLazyLoading(LazyAdvancedFiltersPanel, 'Carregando filtros...');
export const BackupPanel = withLazyLoading(LazyBackupPanel, 'Carregando backup...');
export const DevPerformancePanel = withLazyLoading(LazyDevPerformancePanel, 'Carregando performance...');
export const VirtualizedDataTable = withLazyLoading(LazyVirtualizedDataTable, 'Carregando tabela...');
export const HistoryByDate = withLazyLoading(LazyHistoryByDate, 'Carregando histórico...');

// Dynamic import utilities for other heavy modules
export const loadExcelProcessor = () =>
  import('../workers/excelProcessor.worker').then(module => module.default);

export const loadChartLibrary = () =>
  import('chart.js').then(module => module.default);

export const loadPDFGenerator = () =>
  import('jspdf').then(module => module.default);

export const loadCSVParser = () =>
  import('papaparse').then(module => module.default);

// Preload strategy for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used soon
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      LazyExportModal.preload?.();
      LazyVirtualizedDataTable.preload?.();
    });
  }
};

// Component for preloading on user interaction
export const PreloadTrigger: React.FC<{
  component: React.LazyExoticComponent<any>;
  children: React.ReactNode;
  trigger?: 'hover' | 'focus' | 'click';
}> = ({ component, children, trigger = 'hover' }) => {
  const handlePreload = () => {
    component.preload?.();
  };

  const props = {
    [trigger === 'hover' ? 'onMouseEnter' : trigger === 'focus' ? 'onFocus' : 'onClick']: handlePreload
  };

  return <div {...props}>{children}</div>;
};
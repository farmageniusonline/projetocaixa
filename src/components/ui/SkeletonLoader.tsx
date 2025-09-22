/**
 * Consistent skeleton loader components for better UX during loading states
 */

import React from 'react';

// Base skeleton component
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '1rem',
  rounded = 'md',
  animated = true
}) => {
  const roundedClasses = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  };

  const baseClasses = [
    'bg-gray-200',
    'dark:bg-gray-700',
    roundedClasses[rounded],
    animated ? 'animate-pulse' : '',
    className
  ].filter(Boolean).join(' ');

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  };

  return <div className={baseClasses} style={style} aria-hidden="true" />;
};

// Text skeleton - for single lines of text
interface TextSkeletonProps {
  lines?: number;
  className?: string;
  width?: string[];
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 1,
  className = '',
  width = []
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height="1rem"
          width={width[index] || (index === lines - 1 ? '75%' : '100%')}
          className="block"
        />
      ))}
    </div>
  );
};

// Card skeleton - for card-like components
interface CardSkeletonProps {
  className?: string;
  hasImage?: boolean;
  imageHeight?: string;
  hasHeader?: boolean;
  headerLines?: number;
  bodyLines?: number;
  hasFooter?: boolean;
  footerLines?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  className = '',
  hasImage = false,
  imageHeight = '12rem',
  hasHeader = true,
  headerLines = 1,
  bodyLines = 3,
  hasFooter = false,
  footerLines = 1
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {hasImage && (
        <Skeleton height={imageHeight} width="100%" rounded="none" className="mb-4" />
      )}

      <div className="p-4 space-y-4">
        {hasHeader && (
          <div className="space-y-2">
            <TextSkeleton lines={headerLines} width={['60%']} />
          </div>
        )}

        <div className="space-y-2">
          <TextSkeleton lines={bodyLines} />
        </div>

        {hasFooter && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <TextSkeleton lines={footerLines} width={['40%']} />
          </div>
        )}
      </div>
    </div>
  );
};

// Table skeleton - for data tables
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  hasHeader = true,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
          {hasHeader && (
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {Array.from({ length: columns }, (_, index) => (
                  <th key={index} className="px-6 py-3 text-left">
                    <Skeleton height="1rem" width="80%" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }, (_, colIndex) => (
                  <td key={colIndex} className="whitespace-nowrap px-6 py-4">
                    <Skeleton
                      height="1rem"
                      width={colIndex === 0 ? '90%' : colIndex === columns - 1 ? '60%' : '100%'}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// List skeleton - for list items
interface ListSkeletonProps {
  items?: number;
  hasAvatar?: boolean;
  hasIcon?: boolean;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 3,
  hasAvatar = false,
  hasIcon = false,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
          {hasAvatar && (
            <Skeleton width="2.5rem" height="2.5rem" rounded="full" />
          )}
          {hasIcon && !hasAvatar && (
            <Skeleton width="1.5rem" height="1.5rem" rounded="md" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton height="1rem" width="70%" />
            <Skeleton height="0.875rem" width="50%" />
          </div>
          <Skeleton width="4rem" height="2rem" rounded="md" />
        </div>
      ))}
    </div>
  );
};

// Form skeleton - for forms
interface FormSkeletonProps {
  fields?: number;
  hasTitle?: boolean;
  hasSubmitButton?: boolean;
  className?: string;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  fields = 3,
  hasTitle = true,
  hasSubmitButton = true,
  className = ''
}) => {
  return (
    <div className={`space-y-6 ${className}`}>
      {hasTitle && (
        <Skeleton height="2rem" width="40%" />
      )}

      <div className="space-y-4">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton height="1rem" width="25%" />
            <Skeleton height="2.5rem" width="100%" rounded="md" />
          </div>
        ))}
      </div>

      {hasSubmitButton && (
        <div className="pt-4">
          <Skeleton height="2.5rem" width="8rem" rounded="md" />
        </div>
      )}
    </div>
  );
};

// Dashboard skeleton - for dashboard layouts
interface DashboardSkeletonProps {
  hasHeader?: boolean;
  hasSidebar?: boolean;
  cardCount?: number;
  hasChart?: boolean;
  hasTable?: boolean;
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  hasHeader = true,
  hasSidebar = true,
  cardCount = 4,
  hasChart = true,
  hasTable = true,
  className = ''
}) => {
  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {hasHeader && (
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Skeleton height="2rem" width="12rem" />
              <div className="flex items-center space-x-4">
                <Skeleton width="2rem" height="2rem" rounded="full" />
                <Skeleton width="8rem" height="2rem" rounded="md" />
              </div>
            </div>
          </div>
        </header>
      )}

      <div className="flex">
        {hasSidebar && (
          <aside className="w-64 bg-white dark:bg-gray-800 shadow-sm border-r border-gray-200 dark:border-gray-700 min-h-screen">
            <div className="p-4 space-y-4">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Skeleton width="1.5rem" height="1.5rem" rounded="md" />
                  <Skeleton height="1rem" width="70%" />
                </div>
              ))}
            </div>
          </aside>
        )}

        <main className="flex-1 p-6 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: cardCount }, (_, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton height="1rem" width="60%" />
                    <Skeleton height="2rem" width="80%" />
                  </div>
                  <Skeleton width="3rem" height="3rem" rounded="full" />
                </div>
              </div>
            ))}
          </div>

          {/* Chart section */}
          {hasChart && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="space-y-4">
                <Skeleton height="1.5rem" width="25%" />
                <Skeleton height="20rem" width="100%" rounded="md" />
              </div>
            </div>
          )}

          {/* Table section */}
          {hasTable && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton height="1.5rem" width="25%" />
                  <Skeleton height="2rem" width="8rem" rounded="md" />
                </div>
                <TableSkeleton rows={8} columns={5} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// Banking-specific skeletons
export const BankingTransactionSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Skeleton width="3rem" height="3rem" rounded="full" />
            <div className="space-y-2">
              <Skeleton height="1rem" width="12rem" />
              <Skeleton height="0.875rem" width="8rem" />
            </div>
          </div>
          <div className="text-right space-y-2">
            <Skeleton height="1.25rem" width="6rem" />
            <Skeleton height="0.875rem" width="4rem" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const ConferenceSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-6">
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton height="1.25rem" width="10rem" />
              <Skeleton height="1rem" width="8rem" />
            </div>
            <Skeleton width="6rem" height="2rem" rounded="full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton height="0.875rem" width="6rem" />
              <Skeleton height="1.5rem" width="8rem" />
            </div>
            <div className="space-y-2">
              <Skeleton height="0.875rem" width="6rem" />
              <Skeleton height="1.5rem" width="8rem" />
            </div>
            <div className="space-y-2">
              <Skeleton height="0.875rem" width="6rem" />
              <Skeleton height="1.5rem" width="8rem" />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Skeleton width="5rem" height="2rem" rounded="md" />
            <Skeleton width="5rem" height="2rem" rounded="md" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const UploadProgressSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton height="1.25rem" width="10rem" />
        <Skeleton height="1rem" width="4rem" />
      </div>

      <div className="space-y-2">
        <Skeleton height="0.5rem" width="100%" rounded="full" />
        <div className="flex justify-between">
          <Skeleton height="0.875rem" width="6rem" />
          <Skeleton height="0.875rem" width="4rem" />
        </div>
      </div>

      <div className="space-y-2">
        <Skeleton height="1rem" width="8rem" />
        <div className="space-y-1">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} height="0.875rem" width={`${85 + Math.random() * 15}%`} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Export all skeleton components
export {
  Skeleton as default,
  TextSkeleton,
  CardSkeleton,
  TableSkeleton,
  ListSkeleton,
  FormSkeleton,
  DashboardSkeleton,
  BankingTransactionSkeleton,
  ConferenceSkeleton,
  UploadProgressSkeleton
};
// ========================================
// Core Application Types
// ========================================

// User and Authentication Types
export interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
}

export interface User {
  username: string;
  id?: string;
  email?: string;
  profile?: Profile;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginError: string;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearLoginError: () => void;
}

export interface LoginFormData {
  username: string;
  password: string;
}

// Banking and Transaction Types
export interface BankingTransaction {
  id: string;
  transaction_date: string;
  payment_type: string;
  cpf?: string;
  value: number;
  original_history?: string;
  status: 'pending' | 'conferred' | 'not_found' | 'archived';
  is_transferred: boolean;
}

export interface CashConference {
  id: string;
  conferred_value: number;
  conference_date: string;
  transaction_date: string;
  payment_type: string;
  cpf?: string;
  original_value: number;
  original_history?: string;
}

// Excel Processing Types
export interface ParsedRow {
  date: string;
  paymentType: string;
  cpf: string;
  value: number;
  originalHistory: string;
  validationStatus?: 'valid' | 'warning' | 'error';
  validationMessage?: string;
}

export interface ParseResult {
  success: boolean;
  data: ParsedRow[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    rowsWithWarnings: number;
    rowsWithErrors: number;
    totalValue: number;
  };
}

export interface ProcessedExcelData {
  parseResult: ParseResult;
  valueCentsMap: Map<number, number[]>;
  normalizedEntries: BankEntryForProcessing[];
}

export interface BankEntryForProcessing {
  id: number;
  source_id: string;
  document_number?: string;
  date?: string;
  description?: string;
  value: number;
  value_cents: number;
  transaction_type?: string;
  balance?: number;
  status: 'pending' | 'conferred' | 'not_found' | 'transferred';
  day: string;
}

// Worker Communication Types
export interface WorkerProgressMessage {
  type: 'progress';
  pct: number;
  stage?: string;
  message?: string;
}

export interface WorkerDoneMessage {
  type: 'done';
  payload: ProcessedExcelData;
}

export interface WorkerErrorMessage {
  type: 'error';
  error: {
    name: string;
    message: string;
    stack?: string;
  };
}

export type WorkerMessage = WorkerProgressMessage | WorkerDoneMessage | WorkerErrorMessage;

// Storage and State Types
export interface StorageStatus {
  isLoading: boolean;
  usingIndexedDB: boolean;
  error?: string;
}

export interface FilterState {
  startDate?: string;
  endDate?: string;
  paymentType?: string;
  status?: string;
  searchTerm?: string;
}

// Component Props Types
export interface DataTableProps {
  data: any[];
  columns: string[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
  onFilter?: (filters: FilterState) => void;
}

export interface ExportOptions {
  format: 'excel' | 'pdf' | 'csv';
  dateRange?: {
    start: string;
    end: string;
  };
  includeFilters?: boolean;
}

// API Response Types
export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: any;
}

// Performance Types
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Configuration Types
export interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
  };
  development: {
    enableLogging: boolean;
    enablePerformanceTracking: boolean;
  };
}

// Re-export from auth types for backward compatibility
export type { AuthContextType as AuthContext } from './auth';

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
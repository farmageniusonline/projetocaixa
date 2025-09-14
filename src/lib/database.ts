import { supabase } from './supabase';

// Database abstraction layer that works with both Supabase and PostgreSQL
export interface DatabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
}

// For local development, we'll use a mock user ID
const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001';

// Check if we're using local database
const isLocalMode = import.meta.env.VITE_DATABASE_MODE === 'local';

// Export the appropriate client
export const db: DatabaseClient = isLocalMode ? {
  from: (table: string) => {
    // For local mode, we still use Supabase client but without auth
    return supabase.from(table);
  },
  auth: {
    getUser: async () => ({
      data: {
        user: {
          id: LOCAL_USER_ID
        }
      }
    })
  }
} : supabase;

// Helper function to get current user ID
export async function getCurrentUserId(): Promise<string> {
  if (isLocalMode) {
    return LOCAL_USER_ID;
  }

  const { data } = await supabase.auth.getUser();
  return data?.user?.id || LOCAL_USER_ID;
}
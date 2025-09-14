import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AuthContextType, User } from '../types/auth';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      // Try Supabase authentication first
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@manipularium.com`,
        password: password
      });

      if (error) {
        console.error('Supabase login error:', error.message);

        // Fallback to hardcoded credentials for backward compatibility
        if (username === 'admin' && password === 'manipularium') {
          const userData: User = { username: 'admin' };
          setUser(userData);
          return true;
        }

        return false;
      }

      if (data.user) {
        // Get or create user profile
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              username: data.user.email?.split('@')[0] || 'user',
              full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
              role: 'user'
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError.message);
            profile = {
              id: data.user.id,
              username: data.user.email?.split('@')[0] || 'user',
              full_name: data.user.email?.split('@')[0] || 'user',
              role: 'user'
            };
          } else {
            profile = newProfile;
          }
        }

        const userData: User = {
          username: profile?.username || data.user.email?.split('@')[0] || 'user',
          id: data.user.id,
          email: data.user.email,
          profile: profile
        };

        setUser(userData);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);

      // Fallback for development
      if (username === 'admin' && password === 'manipularium') {
        const userData: User = { username: 'admin' };
        setUser(userData);
        return true;
      }

      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
  };

  // Check for existing session on mount
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Get user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            const userData: User = {
              username: profile?.username || session.user.email?.split('@')[0] || 'user',
              id: session.user.id,
              email: session.user.email,
              profile: profile
            };
            setUser(userData);
          });
      }
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const userData: User = {
          username: profile?.username || session.user.email?.split('@')[0] || 'user',
          id: session.user.id,
          email: session.user.email,
          profile: profile
        };
        setUser(userData);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
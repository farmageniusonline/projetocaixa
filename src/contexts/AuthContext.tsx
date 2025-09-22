import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { AuthContextType, User } from '../types';
import { supabase } from '../lib/supabase';
import { authLogger } from '../utils/logger';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    authLogger.debug('Initializing user state');
    // Try to restore user from localStorage on initialization
    try {
      if (typeof window === 'undefined') return null;
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        // Validate the parsed user object
        if (parsed && typeof parsed === 'object' && parsed.username) {
          return parsed;
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to parse saved user from localStorage:', error);
      // Clear corrupted data
      try {
        localStorage.removeItem('auth_user');
      } catch {}
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string>('');

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setLoginError(''); // Clear previous errors

    try {
      // Try Supabase authentication first
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@manipularium.com`,
        password: password
      });

      if (error) {
        console.error('Supabase login error:', error.message);
        setLoginError('Senha ou Usuario Incorretos');
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
        // Persist user to localStorage
        localStorage.setItem('auth_user', JSON.stringify(userData));
        return true;
      }

      console.log('Login failed: No user data returned');
      setLoginError('Senha ou Usuario Incorretos');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Senha ou Usuario Incorretos');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const clearLoginError = () => {
    setLoginError('');
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    // Remove user from localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('dashboard_filters'); // Clear filters on logout
  };

  // Check for existing session on mount
  useEffect(() => {
    // If user is already loaded from localStorage, just check if session is still valid
    if (user) {
      // Quick validation - if we have a user from localStorage, we can show the dashboard immediately
      // and validate the session in background
      setIsLoading(false);

      // Background session validation (optional) - only if Supabase is configured
      try {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.user) {
            // Session is invalid, logout
            logout();
          }
        }).catch(error => {
          console.warn('Supabase session check failed:', error);
          // Continue with local auth if Supabase fails
        });
      } catch (error) {
        console.warn('Supabase not available:', error);
      }
      return;
    }

    // Get initial session only if no user in localStorage
    try {
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
              // Persist user to localStorage
              localStorage.setItem('auth_user', JSON.stringify(userData));
            });
        }
        setIsLoading(false);
      }).catch(error => {
        console.warn('Supabase session initialization failed:', error);
        setIsLoading(false);
      });
    } catch (error) {
      console.warn('Supabase not available:', error);
      setIsLoading(false);
    }

    // Listen for auth changes - with error handling
    try {
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
          // Persist user to localStorage
          localStorage.setItem('auth_user', JSON.stringify(userData));
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          // Remove user from localStorage
          localStorage.removeItem('auth_user');
          localStorage.removeItem('dashboard_filters'); // Clear filters on logout
        }
        setIsLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.warn('Supabase auth listener failed:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    loginError,
    login,
    logout,
    clearLoginError
  };

  console.log('AuthProvider rendering:', { user, isLoading });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
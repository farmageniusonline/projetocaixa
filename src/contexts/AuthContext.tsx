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
      authLogger.warn('Failed to parse saved user from localStorage:', error);
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
      // Try Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.includes('@') ? username : `${username}@manipularium.com`,
        password: password
      });

      if (error) {
        authLogger.error('Supabase login error:', error.message);
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
            authLogger.error('Error creating profile:', createError.message);
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

      authLogger.debug('Login failed: No user data returned');
      setLoginError('Senha ou Usuario Incorretos');
      return false;
    } catch (error) {
      authLogger.error('Login error:', error);
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
      authLogger.error('Logout error:', error);
    }
    setUser(null);
    // Remove user from localStorage
    localStorage.removeItem('auth_user');
    localStorage.removeItem('dashboard_filters'); // Clear filters on logout
  };

  // Check for existing session on mount
  useEffect(() => {
    let mounted = true;
    let subscription: any = null;

    const initializeAuth = async () => {
      try {
        // If user is already loaded from localStorage, show dashboard immediately
        if (user) {
          if (mounted) setIsLoading(false);

          // Background session validation
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user && mounted) {
              // Session is invalid, logout
              logout();
            }
          } catch (error) {
            authLogger.warn('Session validation failed:', error);
          }
          return;
        }

        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          authLogger.warn('Error getting session:', sessionError);
          if (mounted) setIsLoading(false);
          return;
        }

        if (session?.user) {
          try {
            // Get user profile
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

            if (mounted) {
              setUser(userData);
              localStorage.setItem('auth_user', JSON.stringify(userData));
            }
          } catch (profileError) {
            authLogger.warn('Error fetching profile:', profileError);
          }
        }

        if (mounted) setIsLoading(false);

        // Setup auth state listener
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!mounted) return;

            try {
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
                localStorage.setItem('auth_user', JSON.stringify(userData));
              } else if (event === 'SIGNED_OUT') {
                setUser(null);
                localStorage.removeItem('auth_user');
                localStorage.removeItem('dashboard_filters');
              }
              setIsLoading(false);
            } catch (error) {
              authLogger.warn('Auth state change error:', error);
              setIsLoading(false);
            }
          }
        );

        subscription = authSubscription;
      } catch (error) {
        authLogger.error('Auth initialization error:', error);
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    loginError,
    login,
    logout,
    clearLoginError
  };

  authLogger.debug('AuthProvider rendering:', { user, isLoading });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
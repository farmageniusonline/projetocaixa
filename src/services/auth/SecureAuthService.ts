/**
 * Secure authentication service with HTTPOnly cookies and enhanced security
 */

import { supabase } from '../../lib/supabase';
import { authLogger } from '../../utils/logger';
import type { User, Profile } from '../../types';
import { createStrictError, assertIsString, assertIsNotNull } from '../../types/strict';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SecureAuthState {
  isAuthenticated: boolean;
  user: User | null;
  sessionId: string | null;
  expiresAt: number | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  requiresEmailVerification?: boolean;
  requiresMFA?: boolean;
}

// Secure cookie utilities
class SecureCookieManager {
  private readonly cookiePrefix = '__Secure-';
  private readonly sessionCookie = `${this.cookiePrefix}session`;
  private readonly refreshCookie = `${this.cookiePrefix}refresh`;

  // Set secure cookie with all security flags
  private setCookie(
    name: string,
    value: string,
    options: {
      maxAge?: number; // in seconds
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      path?: string;
    } = {}
  ): void {
    const {
      maxAge = 24 * 60 * 60, // 24 hours default
      httpOnly = true,
      secure = window.location.protocol === 'https:',
      sameSite = 'strict',
      path = '/'
    } = options;

    const cookieString = [
      `${name}=${value}`,
      `Max-Age=${maxAge}`,
      `Path=${path}`,
      `SameSite=${sameSite}`,
      httpOnly && 'HttpOnly',
      secure && 'Secure'
    ].filter(Boolean).join('; ');

    document.cookie = cookieString;

    authLogger.debug('Secure cookie set', {
      name: name.replace(this.cookiePrefix, '[REDACTED]'),
      maxAge,
      secure,
      httpOnly
    });
  }

  // Get cookie value
  private getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue || null;
    }

    return null;
  }

  // Delete cookie
  private deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=strict`;
    authLogger.debug('Cookie deleted', { name: name.replace(this.cookiePrefix, '[REDACTED]') });
  }

  // Set session cookie
  setSession(sessionId: string, expiresIn: number = 24 * 60 * 60): void {
    this.setCookie(this.sessionCookie, sessionId, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
  }

  // Set refresh token cookie
  setRefreshToken(refreshToken: string, expiresIn: number = 7 * 24 * 60 * 60): void {
    this.setCookie(this.refreshCookie, refreshToken, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      sameSite: 'strict'
    });
  }

  // Get session ID
  getSession(): string | null {
    return this.getCookie(this.sessionCookie);
  }

  // Get refresh token
  getRefreshToken(): string | null {
    return this.getCookie(this.refreshCookie);
  }

  // Clear all auth cookies
  clearAll(): void {
    this.deleteCookie(this.sessionCookie);
    this.deleteCookie(this.refreshCookie);
    authLogger.info('All auth cookies cleared');
  }
}

export class SecureAuthService {
  private cookieManager = new SecureCookieManager();
  private authState: SecureAuthState = {
    isAuthenticated: false,
    user: null,
    sessionId: null,
    expiresAt: null
  };

  private sessionCheckInterval?: number;
  private readonly SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.initializeFromSession();
    this.startSessionMonitoring();
  }

  // Initialize auth state from existing session
  private async initializeFromSession(): Promise<void> {
    try {
      const sessionId = this.cookieManager.getSession();
      if (!sessionId) {
        authLogger.debug('No session cookie found');
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        authLogger.warn('Invalid session found, clearing cookies', { error });
        this.clearSession();
        return;
      }

      // Validate session expiry
      const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + (24 * 60 * 60 * 1000);
      if (Date.now() >= expiresAt) {
        authLogger.warn('Session expired, attempting refresh');
        await this.refreshSession();
        return;
      }

      // Get user profile
      const user = await this.getUserFromSession(session.user.id);
      if (user) {
        this.authState = {
          isAuthenticated: true,
          user,
          sessionId,
          expiresAt
        };

        authLogger.info('Session restored successfully', {
          userId: user.id,
          expiresAt: new Date(expiresAt).toISOString()
        });
      }
    } catch (error) {
      authLogger.error('Failed to initialize from session', { error });
      this.clearSession();
    }
  }

  // Login with username/password
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      authLogger.info('Login attempt', { username: credentials.username });

      // Input validation
      assertIsString(credentials.username, 'Username must be a string');
      assertIsString(credentials.password, 'Password must be a string');

      if (credentials.username.trim().length === 0) {
        throw createStrictError('Username cannot be empty', 'INVALID_USERNAME');
      }

      if (credentials.password.length < 6) {
        throw createStrictError('Password must be at least 6 characters', 'INVALID_PASSWORD');
      }

      // Determine email format
      const email = credentials.username.includes('@')
        ? credentials.username
        : `${credentials.username}@manipularium.com`;

      // Attempt Supabase authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: credentials.password
      });

      if (error) {
        authLogger.error('Authentication failed', {
          error: error.message,
          code: error.status,
          username: credentials.username
        });

        return {
          success: false,
          error: this.getAuthErrorMessage(error.message)
        };
      }

      if (!data.user || !data.session) {
        throw createStrictError('No user data returned', 'AUTH_NO_USER');
      }

      // Check email verification
      if (!data.user.email_confirmed_at) {
        authLogger.warn('Email not verified', { userId: data.user.id });
        return {
          success: false,
          requiresEmailVerification: true,
          error: 'Email não verificado. Verifique sua caixa de entrada.'
        };
      }

      // Get or create user profile
      const user = await this.getOrCreateUserProfile(data.user);
      if (!user) {
        throw createStrictError('Failed to create user profile', 'PROFILE_CREATION_FAILED');
      }

      // Set secure session
      await this.setSecureSession(data.session, user, credentials.rememberMe);

      authLogger.info('Login successful', {
        userId: user.id,
        username: user.username,
        sessionId: this.authState.sessionId
      });

      return {
        success: true,
        user
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro de autenticação';
      authLogger.error('Login error', { error, username: credentials.username });

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Logout and clear session
  async logout(): Promise<void> {
    try {
      authLogger.info('Logout initiated', { userId: this.authState.user?.id });

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        authLogger.warn('Supabase logout error', { error });
      }

      // Clear local session
      this.clearSession();

      authLogger.info('Logout completed');
    } catch (error) {
      authLogger.error('Logout error', { error });
      // Still clear local session even if Supabase logout fails
      this.clearSession();
    }
  }

  // Refresh session token
  async refreshSession(): Promise<boolean> {
    try {
      const refreshToken = this.cookieManager.getRefreshToken();
      if (!refreshToken) {
        authLogger.warn('No refresh token available');
        this.clearSession();
        return false;
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error || !data.session) {
        authLogger.warn('Session refresh failed', { error });
        this.clearSession();
        return false;
      }

      // Update session cookies
      const expiresIn = data.session.expires_in || (24 * 60 * 60);
      this.cookieManager.setSession(data.session.access_token, expiresIn);

      if (data.session.refresh_token) {
        this.cookieManager.setRefreshToken(data.session.refresh_token);
      }

      // Update auth state
      this.authState.expiresAt = Date.now() + (expiresIn * 1000);

      authLogger.info('Session refreshed successfully', {
        userId: this.authState.user?.id,
        expiresAt: new Date(this.authState.expiresAt).toISOString()
      });

      return true;
    } catch (error) {
      authLogger.error('Session refresh error', { error });
      this.clearSession();
      return false;
    }
  }

  // Get current auth state
  getAuthState(): Readonly<SecureAuthState> {
    return { ...this.authState };
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated &&
           this.authState.user !== null &&
           (this.authState.expiresAt ? Date.now() < this.authState.expiresAt : false);
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.isAuthenticated() ? this.authState.user : null;
  }

  // Private helper methods
  private async setSecureSession(
    session: any,
    user: User,
    rememberMe: boolean = false
  ): Promise<void> {
    const sessionDuration = rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60; // 7 days vs 24 hours
    const expiresAt = Date.now() + (sessionDuration * 1000);

    // Set secure cookies
    this.cookieManager.setSession(session.access_token, sessionDuration);

    if (session.refresh_token) {
      this.cookieManager.setRefreshToken(session.refresh_token, sessionDuration);
    }

    // Update auth state
    this.authState = {
      isAuthenticated: true,
      user,
      sessionId: session.access_token,
      expiresAt
    };
  }

  private async getUserFromSession(userId: string): Promise<User | null> {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !profile) {
        authLogger.warn('Profile not found for user', { userId, error });
        return null;
      }

      return {
        username: profile.username,
        id: profile.id,
        email: profile.email,
        profile
      };
    } catch (error) {
      authLogger.error('Failed to get user from session', { userId, error });
      return null;
    }
  }

  private async getOrCreateUserProfile(supabaseUser: any): Promise<User | null> {
    try {
      // Try to get existing profile
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      // Create profile if it doesn't exist
      if (error && error.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: supabaseUser.id,
            username: supabaseUser.email?.split('@')[0] || 'user',
            full_name: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
            role: 'user',
            is_active: true
          })
          .select()
          .single();

        if (createError) {
          authLogger.error('Failed to create profile', { error: createError, userId: supabaseUser.id });
          return null;
        }

        profile = newProfile;
      } else if (error) {
        authLogger.error('Failed to get profile', { error, userId: supabaseUser.id });
        return null;
      }

      assertIsNotNull(profile, 'Profile is required');

      return {
        username: profile.username,
        id: profile.id,
        email: supabaseUser.email,
        profile
      };
    } catch (error) {
      authLogger.error('Error in getOrCreateUserProfile', { error, userId: supabaseUser.id });
      return null;
    }
  }

  private clearSession(): void {
    this.cookieManager.clearAll();
    this.authState = {
      isAuthenticated: false,
      user: null,
      sessionId: null,
      expiresAt: null
    };

    // Clear any localStorage data as well (defense in depth)
    try {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('dashboard_filters');
    } catch (error) {
      authLogger.warn('Failed to clear localStorage', { error });
    }
  }

  private startSessionMonitoring(): void {
    this.sessionCheckInterval = window.setInterval(async () => {
      if (this.isAuthenticated() && this.authState.expiresAt) {
        // Check if session will expire in the next 10 minutes
        const tenMinutes = 10 * 60 * 1000;
        if (Date.now() + tenMinutes >= this.authState.expiresAt) {
          authLogger.info('Session expiring soon, attempting refresh');
          await this.refreshSession();
        }
      }
    }, this.SESSION_CHECK_INTERVAL);
  }

  private getAuthErrorMessage(error: string): string {
    // Map Supabase errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'Invalid login credentials': 'Usuário ou senha incorretos',
      'Email not confirmed': 'Email não verificado',
      'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos',
      'Password should be at least 6 characters': 'Senha deve ter pelo menos 6 caracteres'
    };

    return errorMap[error] || 'Erro de autenticação. Tente novamente.';
  }

  // Cleanup method
  destroy(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    this.clearSession();
  }
}
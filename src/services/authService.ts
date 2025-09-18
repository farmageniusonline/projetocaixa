import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'admin' | 'user' | 'viewer';
  isActive: boolean;
}

class AuthService {
  private currentUser: User | null = null;
  private currentSession: Session | null = null;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      this.currentSession = session;
      this.currentUser = session.user;
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user ?? null;

      if (event === 'SIGNED_IN') {
        console.log('User signed in:', session?.user?.email);
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });
  }

  async signUp(credentials: AuthCredentials, profile?: { username?: string; fullName?: string }) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            username: profile?.username,
            full_name: profile?.fullName
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create profile entry
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              username: profile?.username || credentials.email.split('@')[0],
              full_name: profile?.fullName,
              role: 'user',
              is_active: true
            }
          ]);

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  }

  async signIn(credentials: AuthCredentials) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) throw error;

      this.currentUser = data.user;
      this.currentSession = data.session;

      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  }

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      this.currentSession = null;

      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  }

  async resetPassword(email: string) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { error };
    }
  }

  async updatePassword(newPassword: string) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { error };
    }
  }

  async getProfile(): Promise<UserProfile | null> {
    if (!this.currentUser) return null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        email: this.currentUser.email!,
        username: data.username,
        fullName: data.full_name,
        avatarUrl: data.avatar_url,
        role: data.role,
        isActive: data.is_active
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return null;
    }
  }

  async updateProfile(updates: Partial<UserProfile>) {
    if (!this.currentUser) {
      return { error: new Error('No user logged in') };
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: updates.username,
          full_name: updates.fullName,
          avatar_url: updates.avatarUrl
        })
        .eq('id', this.currentUser.id);

      if (error) throw error;

      return { error: null };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error };
    }
  }

  getUser() {
    return this.currentUser;
  }

  getSession() {
    return this.currentSession;
  }

  isAuthenticated() {
    return !!this.currentSession;
  }

  async checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  }

  async refreshSession() {
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('Refresh session error:', error);
      return { session: null, error };
    }

    this.currentSession = session;
    this.currentUser = session?.user ?? null;

    return { session, error: null };
  }
}

export const authService = new AuthService();
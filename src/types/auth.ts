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
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export interface LoginFormData {
  username: string;
  password: string;
}
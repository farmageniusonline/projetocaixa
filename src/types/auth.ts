export interface User {
  username: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export interface LoginFormData {
  username: string;
  password: string;
}
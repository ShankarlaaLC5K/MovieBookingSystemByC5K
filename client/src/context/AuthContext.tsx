import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  getMe,
  loginUser,
  registerUser,
} from "../services/authService";

import type {
  LoginData,
  RegisterData,
  User,
} from "../types/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async (): Promise<void> => {
    const savedToken = localStorage.getItem("token");

    if (!savedToken) {
      setUser(null);
      setToken(null);
      return;
    }

    const response = await getMe();
    setUser(response.user);
    setToken(savedToken);
  }, []);

  useEffect(() => {
    let active = true;

    async function restoreUser() {
      const savedToken = localStorage.getItem("token");

      if (!savedToken) {
        if (active) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await getMe();

        if (active) {
          setUser(response.user);
          setToken(savedToken);
        }
      } catch {
        if (active) {
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void restoreUser();

    return () => {
      active = false;
    };
  }, []);

  async function login(data: LoginData): Promise<void> {
    setError(null);

    try {
      const response = await loginUser(data);

      localStorage.setItem("token", response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  }

  async function register(data: RegisterData): Promise<void> {
    setError(null);

    try {
      const response = await registerUser(data);

      localStorage.setItem("token", response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Registration failed"
      );
      throw err;
    }
  }

  function logout(): void {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setError(null);
  }

  function clearError(): void {
    setError(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
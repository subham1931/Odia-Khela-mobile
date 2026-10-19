import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import '@react-native-firebase/app';
import { getAuth, onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { configureGoogleSignIn } from '@/lib/auth/config';
import { authErrorMessage, mapAuthError, type AuthFlowError } from '@/lib/auth/errors';
import { signInWithGoogleFirebase, signOutGoogleAndFirebase } from '@/lib/auth/googleFirebase';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureGoogleSignIn();
    const unsubscribe = onAuthStateChanged(getAuth(), (next) => {
      setUser(next);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const signInWithGoogle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogleFirebase();
    } catch (err) {
      const mapped = mapAuthError(err) as AuthFlowError;
      if (mapped.code !== 'cancelled') {
        setError(mapped.message);
      }
      throw mapped;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await signOutGoogleAndFirebase();
    } catch (err) {
      setError(authErrorMessage(err));
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const status: AuthStatus = initializing
    ? 'loading'
    : user
      ? 'authenticated'
      : 'unauthenticated';

  const value = useMemo(
    () => ({
      status,
      user,
      busy,
      error,
      clearError,
      signInWithGoogle,
      signOut,
    }),
    [status, user, busy, error, clearError, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

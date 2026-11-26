import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextValue {
  user: User | null;
  emailVerified: boolean;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  authNotice: string | null;
  clearAuthMessages: () => void;
  signInWithGoogle: () => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  upgradeGuestToGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code === 'auth/popup-closed-by-user') {
    return 'A janela de login foi fechada antes da conclusão.';
  }
  if (code === 'auth/popup-blocked') {
    return 'O navegador bloqueou o pop-up de login. Permita pop-ups para este site e tente novamente.';
  }
  if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
    return 'Este método de login ainda não está ativado no Firebase Console (Authentication → Sign-in method). Ative o provedor no console ou use Continuar com Google.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'E-mail ou senha incorretos. Verifique os dados informados.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este e-mail já está cadastrado. Tente fazer login ou recuperar a senha.';
  }
  if (code === 'auth/weak-password') {
    return 'A senha deve ter pelo menos 6 caracteres.';
  }
  if (code === 'auth/invalid-email') {
    return 'Informe um endereço de e-mail válido.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (code === 'auth/credential-already-in-use') {
    return 'Esta conta Google já possui dados próprios no FinanceFlow. Faça sair e entre diretamente com o Google.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Falha de conexão ao autenticar. Verifique sua internet e tente novamente.';
  }
  return error instanceof Error ? error.message : 'Erro ao autenticar.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setEmailVerified(Boolean(nextUser?.emailVerified));
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const clearAuthMessages = () => {
    setAuthError(null);
    setAuthNotice(null);
  };

  const signInWithGoogle = async () => {
    setAuthBusy(true);
    clearAuthMessages();
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const signInAsGuest = async () => {
    setAuthBusy(true);
    clearAuthMessages();
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthBusy(true);
    clearAuthMessages();
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      setEmailVerified(cred.user.emailVerified);
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setAuthBusy(true);
    clearAuthMessages();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user);
      setEmailVerified(cred.user.emailVerified);
      setAuthNotice('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!email.trim()) {
      setAuthError('Informe seu e-mail para receber o link de redefinição de senha.');
      return;
    }
    setAuthBusy(true);
    clearAuthMessages();
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setAuthNotice('E-mail de redefinição de senha enviado. Verifique sua caixa de entrada.');
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    clearAuthMessages();
    try {
      await sendEmailVerification(auth.currentUser);
      setAuthNotice('Novo link de verificação enviado para o seu e-mail.');
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthBusy(true);
    clearAuthMessages();
    try {
      await auth.currentUser.reload();
      // Force fresh ID token so Firestore Security Rules see updated email_verified claim
      await auth.currentUser.getIdToken(true);
      const verified = Boolean(auth.currentUser.emailVerified);
      setEmailVerified(verified);
      if (!verified) {
        setAuthNotice('Seu e-mail ainda consta como não verificado. Confirme no link recebido e tente novamente.');
      }
      return verified;
    } catch (err) {
      setAuthError(translateAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const upgradeGuestToGoogle = async () => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    clearAuthMessages();
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(auth.currentUser, provider);
      setEmailVerified(Boolean(auth.currentUser.emailVerified));
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthBusy(true);
    clearAuthMessages();
    try {
      await signOut(auth);
      setEmailVerified(false);
    } catch (err) {
      setAuthError(translateAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        emailVerified,
        authReady,
        authBusy,
        authError,
        authNotice,
        clearAuthMessages,
        signInWithGoogle,
        signInAsGuest,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerificationStatus,
        upgradeGuestToGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

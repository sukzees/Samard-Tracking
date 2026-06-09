'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signInAnonymously as firebaseSignInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleToken: string | null;
  error: string | null;
  signIn: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
  connectDrive: () => Promise<string | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  googleToken: null,
  error: null,
  signIn: async () => {},
  signInAnonymously: async () => {},
  signOut: async () => {},
  connectDrive: async () => null,
  clearError: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // provider.addScope('https://www.googleapis.com/auth/drive.file'); // We will add scope dynamically when they connect drive
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Error signing in with Google", err);
      if (err?.code === 'auth/network-request-failed' || err?.message?.includes('network-request-failed') || err?.message?.includes('popup')) {
        setError("network-failed");
      } else {
        setError(err?.message || "An error occurred during authentication.");
      }
    }
  };

  const signInAnonymously = async () => {
    setError(null);
    try {
      await firebaseSignInAnonymously(auth);
    } catch (err: any) {
      console.error("Error signing in anonymously", err);
      setError(err?.message || "An error occurred during demo sign in.");
    }
  };

  const connectDrive = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      // Adding standard scopes as well
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleToken(credential.accessToken);
        return credential.accessToken;
      }
      return null;
    } catch (error) {
      console.error("Error connecting to drive", error);
      return null;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setGoogleToken(null);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ user, loading, googleToken, error, signIn, signInAnonymously, signOut, connectDrive, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

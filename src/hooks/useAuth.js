import { useState, useEffect } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { auth } from "../config/firebase.js";

/**
 * Custom hook for authentication
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (error) => {
      setError(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await fbSignOut(auth);
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    signIn,
    signOut,
  };
}

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

/**
 * Custom hook for Firestore document with real-time updates
 */
export function useFirestoreDoc(docRef, { realtime = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    if (realtime) {
      // Real-time listener
      const unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          setData(snap.exists() ? snap.data() : null);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      // One-time fetch
      getDoc(docRef)
        .then((snap) => {
          setData(snap.exists() ? snap.data() : null);
          setLoading(false);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
        });
    }
  }, [docRef, realtime]);

  const save = async (newData, options = {}) => {
    try {
      setError(null);
      await setDoc(docRef, newData, options);
      if (!realtime) {
        setData(newData);
      }
    } catch (err) {
      setError(err);
      throw err;
    }
  };

  return {
    data,
    loading,
    error,
    save,
  };
}

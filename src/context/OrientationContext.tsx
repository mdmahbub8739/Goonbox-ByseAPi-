import React, { createContext, useContext, useState, useEffect } from 'react';
import { Orientation } from '../lib/orientation';

interface OrientationContextType {
  orientation: Orientation;
  setOrientation: (orientation: Orientation) => void;
}

const OrientationContext = createContext<OrientationContextType>({
  orientation: 'straight',
  setOrientation: () => {},
});

const STORAGE_KEY = 'app_orientation_filter';

export function OrientationProvider({ children }: { children: React.ReactNode }) {
  const [orientation, setOrientationState] = useState<Orientation>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'straight' || saved === 'gay' || saved === 'trans' || saved === 'all') {
        return saved as Orientation;
      }
    } catch {
      // ignore
    }
    return 'straight';
  });

  const setOrientation = (val: Orientation) => {
    setOrientationState(val);
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Orientation | null;
      if (saved && ['all', 'straight', 'gay', 'trans'].includes(saved)) {
        setOrientationState(saved);
      } else {
        setOrientationState('straight');
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <OrientationContext.Provider value={{ orientation, setOrientation }}>
      {children}
    </OrientationContext.Provider>
  );
}

export function useOrientation() {
  return useContext(OrientationContext);
}

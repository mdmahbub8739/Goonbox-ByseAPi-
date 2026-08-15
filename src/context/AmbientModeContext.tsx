import React, { createContext, useContext, useState, useEffect } from 'react';

interface AmbientModeContextType {
  ambientMode: boolean;
  setAmbientMode: (val: boolean) => void;
  toggleAmbientMode: () => void;
  ambientIntensity: 'subtle' | 'vibrant' | 'cinema';
  setAmbientIntensity: (intensity: 'subtle' | 'vibrant' | 'cinema') => void;
  ambientColor: string;
  setAmbientColor: (color: string) => void;
}

const AmbientModeContext = createContext<AmbientModeContextType | undefined>(undefined);

export function AmbientModeProvider({ children }: { children: React.ReactNode }) {
  const [ambientMode, setAmbientModeState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('pornvoid_ambient_mode');
      return saved !== null ? saved === 'true' : true; // Default ON like YouTube ambient mode
    } catch {
      return true;
    }
  });

  const [ambientIntensity, setAmbientIntensityState] = useState<'subtle' | 'vibrant' | 'cinema'>(() => {
    try {
      const saved = localStorage.getItem('pornvoid_ambient_intensity');
      return (saved as 'subtle' | 'vibrant' | 'cinema') || 'vibrant';
    } catch {
      return 'vibrant';
    }
  });

  const [ambientColor, setAmbientColor] = useState<string>('#ff0033');

  const setAmbientMode = (val: boolean) => {
    setAmbientModeState(val);
    try {
      localStorage.setItem('pornvoid_ambient_mode', String(val));
    } catch {}
  };

  const toggleAmbientMode = () => {
    setAmbientMode(!ambientMode);
  };

  const setAmbientIntensity = (intensity: 'subtle' | 'vibrant' | 'cinema') => {
    setAmbientIntensityState(intensity);
    try {
      localStorage.setItem('pornvoid_ambient_intensity', intensity);
    } catch {}
  };

  return (
    <AmbientModeContext.Provider
      value={{
        ambientMode,
        setAmbientMode,
        toggleAmbientMode,
        ambientIntensity,
        setAmbientIntensity,
        ambientColor,
        setAmbientColor,
      }}
    >
      {children}
    </AmbientModeContext.Provider>
  );
}

export function useAmbientMode() {
  const context = useContext(AmbientModeContext);
  if (!context) {
    throw new Error('useAmbientMode must be used within an AmbientModeProvider');
  }
  return context;
}

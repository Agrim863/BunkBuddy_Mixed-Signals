import { localDateISO } from '../utils/localDate';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { SimulationHorizon } from '../engine';
import { useWorkspace } from './WorkspaceContext';

interface SimulationContextValue {
  // Bunk Simulator ephemeral inputs
  focusSubjectId: string;
  setFocusSubjectId: (id: string) => void;
  singleDate: string;
  setSingleDate: (date: string) => void;
  selectedSessionKeys: string[];
  toggleSessionKey: (key: string) => void;
  setSelectedSessionKeys: (keys: string[]) => void;
  extraMissedUnits: number;
  setExtraMissedUnits: (units: number) => void;
  otherUpcomingAttendRate: number;
  setOtherUpcomingAttendRate: (rate: number) => void;
  horizon: SimulationHorizon;
  setHorizon: (h: SimulationHorizon) => void;
  resetBunkSimulation: () => void;

  // Mass Bunk Tracker ephemeral inputs
  massBunkDate: string;
  setMassBunkDate: (date: string) => void;
  massBunkEntryIds: string[];
  setMassBunkEntryIds: (ids: string[]) => void;
  toggleMassBunkEntryId: (id: string) => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { activeSemester } = useWorkspace();
  const todayIso = localDateISO();

  const [focusSubjectId, setFocusSubjectId] = useState<string>('all');
  const [singleDate, setSingleDate] = useState<string>(todayIso);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<string[]>([]);
  const [extraMissedUnits, setExtraMissedUnits] = useState<number>(0);
  const [otherUpcomingAttendRate, setOtherUpcomingAttendRate] = useState<number>(1);
  const [horizon, setHorizon] = useState<SimulationHorizon>('next_30_days');

  const [massBunkDate, setMassBunkDate] = useState<string>(todayIso);
  const [massBunkEntryIds, setMassBunkEntryIds] = useState<string[]>([]);

  // Reset ephemeral simulation selections when active semester changes
  useEffect(() => {
    setFocusSubjectId('all');
    setSelectedSessionKeys([]);
    setExtraMissedUnits(0);
    setOtherUpcomingAttendRate(1);
    setHorizon('next_30_days');
    setSingleDate(todayIso);
    setMassBunkDate(todayIso);
    setMassBunkEntryIds([]);
  }, [activeSemester?.id, todayIso]);

  const toggleSessionKey = useCallback((key: string) => {
    setSelectedSessionKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  const toggleMassBunkEntryId = useCallback((id: string) => {
    setMassBunkEntryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const resetBunkSimulation = useCallback(() => {
    setFocusSubjectId('all');
    setSelectedSessionKeys([]);
    setExtraMissedUnits(0);
    setOtherUpcomingAttendRate(1);
    setHorizon('next_30_days');
    setSingleDate(todayIso);
  }, [todayIso]);

  return (
    <SimulationContext.Provider
      value={{
        focusSubjectId,
        setFocusSubjectId,
        singleDate,
        setSingleDate,
        selectedSessionKeys,
        toggleSessionKey,
        setSelectedSessionKeys,
        extraMissedUnits,
        setExtraMissedUnits,
        otherUpcomingAttendRate,
        setOtherUpcomingAttendRate,
        horizon,
        setHorizon,
        resetBunkSimulation,
        massBunkDate,
        setMassBunkDate,
        massBunkEntryIds,
        setMassBunkEntryIds,
        toggleMassBunkEntryId,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used inside a SimulationProvider');
  }
  return ctx;
}

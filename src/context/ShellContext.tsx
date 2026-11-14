import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { envConfig } from '../config/env';
import type {
  AppNotification,
  DataPersistenceMode,
  NavRouteId,
  UserProfile,
} from '../types/domain';
import { NAV_ITEMS } from '../types/navigation';

export type ThemeMode = 'light' | 'dark' | 'system';

const SIDEBAR_STORAGE_KEY = 'bunkwise.ui.sidebarCollapsed';
const THEME_STORAGE_KEY = 'bunkwise.ui.theme';
const VALID_ROUTES = new Set<NavRouteId>(NAV_ITEMS.map((item) => item.id));

function readRouteFromHash(): NavRouteId {
  if (typeof window === 'undefined') return 'overview';
  const raw = window.location.hash.replace(/^#\/?/, '').trim() as NavRouteId;
  return VALID_ROUTES.has(raw) ? raw : 'overview';
}

function readSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'light'; // Default to light mode for new users
}

export interface ShellContextValue {
  activeRoute: NavRouteId;
  navigate: (route: NavRouteId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  persistenceMode: DataPersistenceMode;
  user: UserProfile;
  notifications: AppNotification[];
  unreadCount: number;
  markAllNotificationsRead: () => void;
  dismissNotification: (id: string) => void;
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [activeRoute, setActiveRoute] = useState<NavRouteId>(readRouteFromHash);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(readSidebarCollapsed);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemPrefersDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage write restrictions
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => [
    {
      id: 'sys-persistence-mode',
      title: envConfig.hasSupabaseConfig
        ? 'Supabase Environment Detected'
        : 'Local Development Mode Active',
      message: envConfig.hasSupabaseConfig
        ? 'Supabase URL and anon key detected. Remote auth & persistence enabled.'
        : 'Supabase credentials are not configured. Data persists locally in browser storage.',
      severity: envConfig.hasSupabaseConfig ? 'info' : 'warning',
      createdAt: 'System status',
      read: false,
      targetRoute: 'settings',
    },
    {
      id: 'sys-phase-ready',
      title: 'Bunk Planner Modern SaaS Active',
      message: 'Balanced Modern SaaS design with Warm Oat Milk & Royal Plum palette, dual theme support, and micro-interactions.',
      severity: 'success',
      createdAt: 'Design System',
      read: false,
      targetRoute: 'overview',
    },
  ]);

  const navigate = useCallback((route: NavRouteId) => {
    setActiveRoute(route);
    setMobileNavOpen(false);
    setSearchOpen(false);
    if (typeof window !== 'undefined') {
      const nextHash = `#/${route}`;
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveRoute(readRouteFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write restrictions
      }
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const user: UserProfile = useMemo(
    () => ({
      id: 'local-user',
      name: envConfig.hasSupabaseConfig ? 'Guest (Not Signed In)' : 'Local Student',
      email: envConfig.hasSupabaseConfig
        ? 'Sign in via Settings'
        : 'local-mode@browser.storage',
      mode: envConfig.persistenceMode,
    }),
    [],
  );

  const value: ShellContextValue = {
    activeRoute,
    navigate,
    sidebarCollapsed,
    toggleSidebar,
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    persistenceMode: envConfig.persistenceMode,
    user,
    notifications,
    unreadCount,
    markAllNotificationsRead,
    dismissNotification,
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error('useShell must be used inside a ShellProvider');
  }
  return ctx;
}

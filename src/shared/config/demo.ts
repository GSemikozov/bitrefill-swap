import { create } from 'zustand';
import { env } from './env';

const DEMO_STORAGE_KEY = 'bitrefill-swap-demo';

/**
 * Initial demo state: a localStorage override wins, the env var only sets the
 * default. Pure and exported so it can be unit-tested without re-importing the
 * module.
 */
export function resolveDemoDefault(): boolean {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  }
  return env.VITE_DEMO_PAYMENT === 'balance';
}

interface DemoState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

/**
 * Reactive source of truth for demo mode. Toggling updates subscribers in place
 * — no full-page reload (which would remount the wallet providers and flicker
 * the UI). Persisted to localStorage so the choice survives reloads.
 */
const useDemoStore = create<DemoState>((set) => ({
  enabled: resolveDemoDefault(),
  setEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEMO_STORAGE_KEY, enabled ? 'on' : 'off');
    }
    set({ enabled });
  },
}));

/** Call-time read for non-reactive modules (API clients, orchestrator). */
export function isDemoPayment(): boolean {
  return useDemoStore.getState().enabled;
}

/** Reactive subscription for components — re-renders when the mode flips. */
export function useIsDemoPayment(): boolean {
  return useDemoStore((s) => s.enabled);
}

export function setDemoPayment(enabled: boolean): void {
  useDemoStore.getState().setEnabled(enabled);
}

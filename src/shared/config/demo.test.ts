import { afterEach, describe, expect, it } from 'vitest';
import { isDemoPayment, resolveDemoDefault, setDemoPayment } from './demo';
import { env } from './env';

describe('demo mode', () => {
  afterEach(() => {
    // Reset the store first, then clear storage last — setDemoPayment writes to
    // localStorage, so clearing afterwards leaves a clean slate for the next test.
    setDemoPayment(false);
    env.VITE_DEMO_PAYMENT = undefined;
    window.localStorage.clear();
  });

  it('setDemoPayment flips the reactive source of truth', () => {
    setDemoPayment(true);
    expect(isDemoPayment()).toBe(true);
    setDemoPayment(false);
    expect(isDemoPayment()).toBe(false);
  });

  it('persists the choice to localStorage', () => {
    setDemoPayment(true);
    expect(window.localStorage.getItem('bitrefill-swap-demo')).toBe('on');
    setDemoPayment(false);
    expect(window.localStorage.getItem('bitrefill-swap-demo')).toBe('off');
  });

  it('resolveDemoDefault: localStorage override wins over the env default', () => {
    env.VITE_DEMO_PAYMENT = 'balance';
    expect(resolveDemoDefault()).toBe(true);

    window.localStorage.setItem('bitrefill-swap-demo', 'off');
    expect(resolveDemoDefault()).toBe(false);

    window.localStorage.setItem('bitrefill-swap-demo', 'on');
    env.VITE_DEMO_PAYMENT = undefined;
    expect(resolveDemoDefault()).toBe(true);
  });

  it('resolveDemoDefault: falls back to the env variable', () => {
    expect(resolveDemoDefault()).toBe(false);
    env.VITE_DEMO_PAYMENT = 'balance';
    expect(resolveDemoDefault()).toBe(true);
  });
});

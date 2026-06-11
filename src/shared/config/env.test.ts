import { afterEach, describe, expect, it } from 'vitest';
import { env, isDemoPayment, setDemoPayment } from './env';

describe('isDemoPayment', () => {
  afterEach(() => {
    window.localStorage.clear();
    env.VITE_DEMO_PAYMENT = undefined;
  });

  it('defaults to the env variable', () => {
    expect(isDemoPayment()).toBe(false);
    env.VITE_DEMO_PAYMENT = 'balance';
    expect(isDemoPayment()).toBe(true);
  });

  it('localStorage override wins over the env default', () => {
    setDemoPayment(true);
    expect(isDemoPayment()).toBe(true);

    env.VITE_DEMO_PAYMENT = 'balance';
    setDemoPayment(false);
    expect(isDemoPayment()).toBe(false);
  });
});

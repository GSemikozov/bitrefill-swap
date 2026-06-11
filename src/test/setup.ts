import '@testing-library/jest-dom/vitest';

// jsdom lacks layout APIs that cmdk (Command palette) relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};

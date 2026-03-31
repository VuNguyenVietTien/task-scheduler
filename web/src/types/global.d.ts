/// <reference types="@jest/globals" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  // Re-export Jest globals
  export const jest: typeof import('@jest/globals').jest;
  export const describe: typeof import('@jest/globals').describe;
  export const expect: typeof import('@jest/globals').expect;
  export const it: typeof import('@jest/globals').it;
  export const beforeAll: typeof import('@jest/globals').beforeAll;
  export const afterAll: typeof import('@jest/globals').afterAll;
  export const beforeEach: typeof import('@jest/globals').beforeEach;
  export const afterEach: typeof import('@jest/globals').afterEach;

  // Event listener types
  type MediaQueryListener = (this: MediaQueryList, ev: MediaQueryListEvent) => void;
  type GenericEventListener = (event: Event) => void;

  // Extend Window interface for mocks
  interface Window {
    matchMedia: (query: string) => {
      matches: boolean;
      media: string;
      onchange: null;
      addListener: (listener: MediaQueryListener) => void;
      removeListener: (listener: MediaQueryListener) => void;
      addEventListener: (type: string, listener: GenericEventListener) => void;
      removeEventListener: (type: string, listener: GenericEventListener) => void;
      dispatchEvent: (event: Event) => boolean;
    };
    IntersectionObserver: {
      new(): {
        observe: (target: Element) => void;
        unobserve: (target: Element) => void;
        disconnect: () => void;
      };
    };
    ResizeObserver: {
      new(): {
        observe: (target: Element) => void;
        unobserve: (target: Element) => void;
        disconnect: () => void;
      };
    };
    Quill: any;
  }

  // Extend Jest Matchers
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveAttribute(attr: string, value?: string): R;
      toHaveClass(className: string): R;
      toHaveStyle(style: Record<string, unknown>): R;
      toHaveTextContent(text: string | RegExp): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveValue(value: string | number | string[]): R;
      toBeChecked(): R;
    }
  }
}

// This empty export is needed to make this a module
export {};

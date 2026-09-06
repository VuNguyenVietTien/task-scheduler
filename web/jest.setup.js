import '@testing-library/jest-dom'
import 'whatwg-fetch'
import { webcrypto } from 'crypto'
import { TextDecoder, TextEncoder } from 'util'

// jsdom does not expose Node's encoding globals, but server-side auth code uses
// the standard Web API implementations that are available in production.
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
Object.defineProperty(global, 'crypto', {
  configurable: true,
  value: webcrypto,
})

// Mock intersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() { return null }
  unobserve() { return null }
  disconnect() { return null }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() { return null }
  unobserve() { return null }
  disconnect() { return null }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

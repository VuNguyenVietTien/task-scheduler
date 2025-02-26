import '@testing-library/jest-dom';
import 'whatwg-fetch';

// Mock window.matchMedia
window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

window.IntersectionObserver = MockIntersectionObserver as any;

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

window.ResizeObserver = MockResizeObserver as any;

// Set timezone for consistent date testing
process.env.TZ = 'UTC';

// Mock Date.now for consistent testing
const mockDate = new Date('2025-02-25T12:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

export {};

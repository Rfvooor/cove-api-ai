import * as dotenv from 'dotenv';
import * as path from 'path';

// Declare global test utilities type
declare global {
  interface TestUtils {
    createMockAgent: () => {
      run: jest.MockFunction<any>;
      addTool: jest.MockFunction<any>;
    };
    generateRandomString: (length?: number) => string;
  }

  namespace NodeJS {
    interface Global {
      testUtils: TestUtils;
    }
  }
}

// Configure test environment
function setupTestEnvironment(): void {
  // Load test-specific environment variables
  const testEnvPath = path.resolve(__dirname, '../.env.test');
  dotenv.config({ path: testEnvPath });

  // Set up global test configurations
  setupGlobalTestConfigs();

  // Configure error handling
  setupErrorHandling();

  // Optional: Add any global test utilities
  setupTestUtilities();
}

// Set up global test configurations
function setupGlobalTestConfigs(): void {
  // Configure test timeout
  if (typeof global.jest !== 'undefined') {
    global.jest.setTimeout(30000); // 30 seconds default timeout
  }

  // Set up default mock implementations
  setupDefaultMocks();
}

// Configure default mocks for common dependencies
function setupDefaultMocks(): void {
  if (typeof global.jest !== 'undefined') {
    // Mock console methods to reduce noise during testing
    global.console.log = global.jest.fn();
    global.console.warn = global.jest.fn();
    global.console.error = global.jest.fn();

    // Mock common Node.js modules
    global.jest.mock('fs', () => ({
      ...require('fs'),
      promises: {
        ...require('fs').promises,
        readFile: global.jest.fn(),
        writeFile: global.jest.fn(),
      },
    }));

    // Mock external service integrations
    global.jest.mock('@/integrations/openrouter', () => ({
      OpenrouterIntegration: global.jest.fn().mockImplementation(() => ({
        generateResponse: global.jest.fn().mockResolvedValue('Mocked response'),
      })),
    }));
  }
}

// Set up global error handling for tests
function setupErrorHandling(): void {
  // Capture unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection in Test Environment:', reason);
    throw reason;
  });

  // Capture uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in Test Environment:', error);
    process.exit(1);
  });
}

// Add global test utilities
function setupTestUtilities(): void {
  // Add custom assertion methods
  if (typeof expect !== 'undefined' && 'extend' in expect) {
    (expect as any).extend({
      toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
          return {
            message: () =>
              `expected ${received} not to be within range ${floor} - ${ceiling}`,
            pass: true,
          };
        } else {
          return {
            message: () =>
              `expected ${received} to be within range ${floor} - ${ceiling}`,
            pass: false,
          };
        }
      },
    });
  }

  // Add global test helper methods
  global.testUtils = {
    // Example utility method
    createMockAgent: () => ({
      run: global.jest.fn().mockResolvedValue('Mock agent response'),
      addTool: global.jest.fn(),
    }),

    // Generate random test data
    generateRandomString: (length = 10) => {
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    },
  };
}

// Run setup
setupTestEnvironment();

// Export for potential external use
export {
  setupTestEnvironment,
  setupGlobalTestConfigs,
  setupDefaultMocks,
  setupErrorHandling,
  setupTestUtilities,
};
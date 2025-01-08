import * as dotenv from 'dotenv';
import * as path from 'path';

// Global setup function for Jest
module.exports = async (): Promise<void> => {
  // Load environment variables from .env file
  const envPath = path.resolve(__dirname, '../.env.test');
  dotenv.config({ path: envPath });

  // Global setup tasks
  console.log('🚀 Global Test Setup');

  // Initialize test database
  try {
    await initializeTestDatabase();
  } catch (error) {
    console.error('Failed to initialize test database:', error);
  }

  // Setup mock services
  setupMockServices();

  // Any additional global setup logic
  console.log('✅ Test Environment Initialized');
};

// Initialize test database
async function initializeTestDatabase(): Promise<void> {
  console.log('Initializing test database...');
  // Implement database initialization logic
  // For example:
  // - Create test schemas
  // - Reset data
  // - Set up test database connections
}

// Setup mock services and dependencies
function setupMockServices(): void {
  console.log('Setting up mock services...');

  // Check if global jest is available
  if (typeof global.jest !== 'undefined') {
    // Mock OpenRouter integration
    global.jest.mock('@/integrations/openrouter', () => ({
      OpenrouterIntegration: global.jest.fn().mockImplementation(() => ({
        generateResponse: global.jest.fn().mockResolvedValue('Mocked response'),
      })),
    }));

    // Mock file system operations
    global.jest.mock('fs', () => ({
      ...require('fs'),
      promises: {
        ...require('fs').promises,
        readFile: global.jest.fn(),
        writeFile: global.jest.fn(),
      },
    }));
  } else {
    console.warn('Jest mocking not available. Skipping service mocks.');
  }
}

// Optional: Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
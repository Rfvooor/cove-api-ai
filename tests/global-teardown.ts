import * as path from 'path';

// Global teardown function for Jest
module.exports = async (): Promise<void> => {
  console.log('🧹 Global Test Teardown');

  try {
    // Cleanup test database
    await cleanupTestDatabase();

    // Clear any temporary files or resources
    await clearTemporaryResources();

    // Reset global state
    resetGlobalState();

    console.log('✅ Test Environment Cleaned Up');
  } catch (error) {
    console.error('❌ Test Teardown Failed:', error);
  }
};

// Cleanup test database
async function cleanupTestDatabase(): Promise<void> {
  console.log('Cleaning up test database...');
  try {
    // Implement database cleanup logic
    // Examples:
    // - Drop test schemas
    // - Reset database state
    // - Close database connections
  } catch (error) {
    console.error('Database cleanup failed:', error);
  }
}

// Clear temporary resources created during testing
async function clearTemporaryResources(): Promise<void> {
  console.log('Clearing temporary resources...');
  try {
    // Remove temporary files
    // Clear cache directories
    // Close any open connections or streams
  } catch (error) {
    console.error('Temporary resource cleanup failed:', error);
  }
}

// Reset global state to prevent test pollution
function resetGlobalState(): void {
  console.log('Resetting global state...');

  // Clear mocks
  if (typeof global.jest !== 'undefined') {
    global.jest.clearAllMocks();
    global.jest.resetAllMocks();
  }

  // Reset environment variables
  Object.keys(process.env)
    .filter(key => key.startsWith('TEST_'))
    .forEach(key => {
      delete process.env[key];
    });

  // Reset any global variables or caches
  // Example:
  // globalThis.myGlobalCache = new Map();
}

// Optional: Handle any lingering async operations
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection during Teardown:', reason);
});
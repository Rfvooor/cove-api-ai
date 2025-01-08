/**
 * Configuration utility for managing environment variables and settings
 */

export interface CodeExecutionConfig {
  enabled: boolean;
  timeout: number;
  workDir: string;
  allowedLanguages: string[];
  sandboxMode: boolean;
  maxExecutionTime: number;
  maxMemoryUsage: number;
}

export interface SearchConfig {
  googleApiKey: string;
  searchEngineId: string;
}

export interface SecurityConfig {
  sandboxMode: boolean;
  maxExecutionTime: number;
  maxMemoryUsage: number;
}

class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {
    // Private constructor to enforce singleton
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getCodeExecutionConfig(): CodeExecutionConfig {
    const allowedLanguages = process.env.ALLOWED_LANGUAGES?.split(',') || [
      'javascript',
      'typescript',
      'python',
      'ruby',
      'shell'
    ];

    return {
      enabled: process.env.CODE_EXECUTION_ENABLED === 'true',
      timeout: parseInt(process.env.CODE_EXECUTION_TIMEOUT || '5000', 10),
      workDir: process.env.CODE_EXECUTION_WORK_DIR || './tmp/code-execution',
      allowedLanguages,
      sandboxMode: process.env.SANDBOX_MODE !== 'false',
      maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '30000', 10),
      maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '512', 10)
    };
  }

  getSearchConfig(): SearchConfig {
    const config: SearchConfig = {
      googleApiKey: process.env.GOOGLE_SEARCH_API_KEY || '',
      searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID || ''
    };

    if (!config.googleApiKey || !config.searchEngineId) {
      throw new Error('Google Search API configuration is missing');
    }

    return config;
  }

  getSecurityConfig(): SecurityConfig {
    return {
      sandboxMode: process.env.SANDBOX_MODE !== 'false',
      maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '30000', 10),
      maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '512', 10)
    };
  }

  validateConfig(): void {
    // Validate code execution configuration
    if (this.getCodeExecutionConfig().enabled) {
      const codeConfig = this.getCodeExecutionConfig();
      if (!codeConfig.workDir) {
        throw new Error('Code execution work directory is not configured');
      }
      if (codeConfig.timeout <= 0) {
        throw new Error('Invalid code execution timeout');
      }
      if (codeConfig.allowedLanguages.length === 0) {
        throw new Error('No allowed languages configured for code execution');
      }
    }

    // Validate search configuration
    try {
      this.getSearchConfig();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('Search functionality will be disabled:', errorMessage);
    }

    // Validate security configuration
    const securityConfig = this.getSecurityConfig();
    if (securityConfig.maxExecutionTime <= 0) {
      throw new Error('Invalid maximum execution time');
    }
    if (securityConfig.maxMemoryUsage <= 0) {
      throw new Error('Invalid maximum memory usage');
    }
  }

  // Helper method to check if a feature is enabled
  isFeatureEnabled(feature: 'codeExecution' | 'search'): boolean {
    switch (feature) {
      case 'codeExecution':
        return this.getCodeExecutionConfig().enabled;
      case 'search':
        try {
          this.getSearchConfig();
          return true;
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}

// Export singleton instance
export const config = ConfigManager.getInstance();
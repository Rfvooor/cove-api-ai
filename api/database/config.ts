import { Sequelize, Options } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration types
interface DbConfig extends Options {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  dialect: 'postgres';
  logging: boolean | ((sql: string, timing?: number) => void);
  pool?: {
    max: number;
    min: number;
    acquire: number;
    idle: number;
  };
}

interface Config {
  development: DbConfig;
  test: DbConfig;
  production: DbConfig;
}

// Database configuration
const config: Config = {
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cove_api_dev',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: console.log,
  },
  test: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cove_api_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cove_api',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
};

// Create Sequelize instance based on environment
const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env as keyof typeof config];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
  }
);

// Test database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
}

// Initialize database
async function initializeDatabase() {
  try {
    // Test connection
    await testConnection();

    // Sync models
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export { sequelize, testConnection, initializeDatabase };
export default sequelize;
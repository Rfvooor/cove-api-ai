import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agent_swarm_db',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Import models
import { Agent } from './sequelize/agent.model';
import { Swarm } from './sequelize/swarm.model';
import { Tool } from './tool.model';
import { TaskExecution } from './task-execution.model';
import { AgentSwarm } from './agent-swarm.model';

// Define models object for type safety
const models = {
    Agent,
    Swarm,
    Tool,
    TaskExecution,
    AgentSwarm
};

// Set up associations
Object.values(models).forEach((model: any) => {
    if (model.associate) {
        model.associate(models);
    }
});

// Database synchronization function
async function syncDatabase(force: boolean = false) {
    try {
        await sequelize.sync({ force });
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Failed to synchronize database:', error);
        throw error;
    }
}

// Test database connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

// Create database tables if they don't exist
async function initializeDatabase() {
    try {
        // Test connection
        await testConnection();

        // Create tables
        await syncDatabase();

        // Create default indexes
        await Promise.all([
            sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_agents_created_at ON agents (created_at);
                CREATE INDEX IF NOT EXISTS idx_swarms_created_at ON swarms (created_at);
                CREATE INDEX IF NOT EXISTS idx_task_executions_created_at ON task_executions (created_at);
                CREATE INDEX IF NOT EXISTS idx_tools_created_at ON tools (created_at);
                CREATE INDEX IF NOT EXISTS idx_agent_swarms_created_at ON agent_swarms (created_at);
            `)
        ]);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Export everything needed for the API
export {
    sequelize,
    models,
    Agent,
    Swarm,
    Tool,
    TaskExecution,
    AgentSwarm,
    syncDatabase,
    testConnection,
    initializeDatabase
};
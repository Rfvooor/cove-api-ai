import { Router } from 'express';
import { AgentBusiness } from '../business/agent.business.js';
import {
  authenticate,
  authorize,
  validateCreateAgent,
  validateUpdateAgent,
  validateTaskExecution,
  validateUUID,
  taskLimiter,
  createError,
} from '../middleware/index.js';

const router = Router();
const agentBusiness = new AgentBusiness();

// Create a new agent
router.post('/',
  authenticate,
  authorize(['admin', 'agent-creator']),
  validateCreateAgent,
  async (req, res, next) => {
    try {
      const agent = await agentBusiness.create(req.body);
      
      res.status(201).json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          config: agent.config,
          metrics: agent.metrics,
          status: agent.status,
        }
      });
    } catch (error) {
      next(error instanceof Error ? error : createError.internal('Failed to create agent'));
    }
  }
);

// Execute a task
router.post('/:agentId/execute',
  authenticate,
  validateUUID('agentId'),
  validateTaskExecution,
  taskLimiter,
  async (req, res, next) => {
    try {
      const { input, context } = req.body;
      const agentId = req.params.agentId;
      
      const result = await agentBusiness.executeTask(agentId, input, context);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get agent status
router.get('/:agentId',
  authenticate,
  validateUUID('agentId'),
  async (req, res, next) => {
    try {
      const agent = await agentBusiness.findById(req.params.agentId);
      
      res.json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          config: agent.config,
          metrics: agent.metrics,
          status: agent.status,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// List agents with pagination
router.get('/',
  authenticate,
  async (req, res, next) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const order = (req.query.order as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      const result = await agentBusiness.findAll({
        limit,
        offset,
        order: [[sortBy, order]]
      });
      
      res.json({
        success: true,
        data: {
          items: result.items.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
            config: agent.config,
            metrics: agent.metrics,
            status: agent.status,
          })),
          total: result.total,
          limit: result.limit,
          offset: result.offset
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update agent configuration
router.patch('/:agentId',
  authenticate,
  authorize(['admin', 'agent-manager']),
  validateUUID('agentId'),
  validateUpdateAgent,
  async (req, res, next) => {
    try {
      const agent = await agentBusiness.update(req.params.agentId, req.body);
      
      res.json({
        success: true,
        data: {
          id: agent.id,
          name: agent.name,
          description: agent.description,
          config: agent.config,
          metrics: agent.metrics,
          status: agent.status,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete agent
router.delete('/:agentId',
  authenticate,
  authorize(['admin']),
  validateUUID('agentId'),
  async (req, res, next) => {
    try {
      await agentBusiness.delete(req.params.agentId);
      
      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
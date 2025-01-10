import { Router } from 'express';
import { SwarmBusiness } from '../business/swarm.business.js';
import {
  authenticate,
  authorize,
  validateCreateSwarm,
  validateUpdateSwarm,
  validateTaskExecution,
  validateUUID,
  validateAddAgentToSwarm,
  taskLimiter,
  createError,
} from '../middleware/index.js';

const router = Router();
const swarmBusiness = new SwarmBusiness();

// Create a new swarm
router.post('/',
  authenticate,
  authorize(['admin', 'swarm-creator']),
  validateCreateSwarm,
  async (req, res, next) => {
    try {
      const swarm = await swarmBusiness.create(req.body);
      
      res.status(201).json({
        success: true,
        data: {
          id: swarm.id,
          name: swarm.name,
          description: swarm.description,
          config: swarm.config,
          metrics: swarm.metrics,
          status: swarm.status,
        }
      });
    } catch (error) {
      next(error instanceof Error ? error : createError.internal('Failed to create swarm'));
    }
  }
);

// Execute a task on the swarm
router.post('/:swarmId/execute',
  authenticate,
  validateUUID('swarmId'),
  validateTaskExecution,
  taskLimiter,
  async (req, res, next) => {
    try {
      const { input, context } = req.body;
      const swarmId = req.params.swarmId;
      
      const result = await swarmBusiness.executeTask(swarmId, input, context);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get swarm status
router.get('/:swarmId',
  authenticate,
  validateUUID('swarmId'),
  async (req, res, next) => {
    try {
      const swarm = await swarmBusiness.findById(req.params.swarmId);
      
      res.json({
        success: true,
        data: {
          id: swarm.id,
          name: swarm.name,
          description: swarm.description,
          config: swarm.config,
          metrics: swarm.metrics,
          status: swarm.status,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update swarm configuration
router.patch('/:swarmId',
  authenticate,
  authorize(['admin', 'swarm-manager']),
  validateUUID('swarmId'),
  validateUpdateSwarm,
  async (req, res, next) => {
    try {
      const swarm = await swarmBusiness.update(req.params.swarmId, req.body);
      
      res.json({
        success: true,
        data: {
          id: swarm.id,
          name: swarm.name,
          description: swarm.description,
          config: swarm.config,
          metrics: swarm.metrics,
          status: swarm.status,
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add agent to swarm
router.post('/:swarmId/agents',
  authenticate,
  authorize(['admin', 'swarm-manager']),
  validateUUID('swarmId'),
  validateAddAgentToSwarm,
  async (req, res, next) => {
    try {
      const { agentId } = req.body;
      const swarmId = req.params.swarmId;
      
      await swarmBusiness.addAgent(swarmId, agentId);
      
      res.json({
        success: true,
        message: 'Agent added to swarm successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Remove agent from swarm
router.delete('/:swarmId/agents/:agentId',
  authenticate,
  authorize(['admin', 'swarm-manager']),
  validateUUID('swarmId'),
  validateUUID('agentId'),
  async (req, res, next) => {
    try {
      const { swarmId, agentId } = req.params;
      
      await swarmBusiness.removeAgent(swarmId, agentId);
      
      res.json({
        success: true,
        message: 'Agent removed from swarm successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete swarm
router.delete('/:swarmId',
  authenticate,
  authorize(['admin']),
  validateUUID('swarmId'),
  async (req, res, next) => {
    try {
      await swarmBusiness.delete(req.params.swarmId);
      
      res.json({
        success: true,
        message: 'Swarm deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
import express from 'express';
import { TaskExecution, TaskExecutionAttributes } from '../models/task-execution.model.js';
import { ApiResponse } from '../models/types.js';

const router = express.Router();

// Get all tasks with pagination
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const tasks = await TaskExecution.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    const response: ApiResponse<{
      tasks: TaskExecutionAttributes[];
      total: number;
      limit: number;
      offset: number;
    }> = {
      success: true,
      data: {
        tasks: tasks.rows,
        total: tasks.count,
        limit,
        offset
      }
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Get task by ID
router.get('/:id', async (req, res, next) => {
  try {
    const task = await TaskExecution.findByPk(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const response: ApiResponse<TaskExecutionAttributes> = {
      success: true,
      data: task.toJSON() as TaskExecutionAttributes
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Cancel task
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const task = await TaskExecution.findByPk(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    const taskData = task.toJSON() as TaskExecutionAttributes;
    if (taskData.status === 'completed' || taskData.status === 'failed') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel completed or failed task'
      });
    }

    await task.update({
      status: 'cancelled',
      completedAt: new Date()
    });

    const response: ApiResponse<TaskExecutionAttributes> = {
      success: true,
      data: task.toJSON() as TaskExecutionAttributes
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Delete task
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await TaskExecution.findByPk(req.params.id);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    await task.destroy();

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Task deleted successfully' }
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
import express from 'ultimate-express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tribot = express.Router();
const base_route = ''; // Since we're already under /tribot in main app

// In-memory task queue and bot status storage
let taskQueue = [];
let taskIdCounter = 1;
let botStatus = new Map(); // bot_id -> status info

// CORS middleware (already applied globally, but kept for consistency)
tribot.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, osrstoolsauthenticate");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    next();
});

// Health check endpoint
tribot.get('/healthy', async (req, res) => {
    try {
        return res.status(200).json({
            status: "ok",
            database: false, // Set to true when you add database
            timestamp: new Date().toISOString(),
            service: "tribot",
            queue_size: taskQueue.length,
            active_bots: botStatus.size
        });
    } catch (error) {
        console.error("Tribot health check failed:", error.message);
        return res.status(500).json({
            status: "error",
            database: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            service: "tribot"
        });
    }
});

// ===================
// TASK QUEUE API
// ===================

// Add task to queue
tribot.post('/addTask', async (req, res) => {
    try {
        const { task, bot_id = 'default', priority = 'normal' } = req.body;
        
        if (!task) {
            return res.status(400).json({
                error: 'Task is required',
                timestamp: new Date().toISOString()
            });
        }

        // Validate and format different task types
        let formattedCommand = '';
        
        if (task === 'walk' && Array.isArray(req.body) && req.body.length >= 2) {
            const [x, y, z] = req.body;
            formattedCommand = z !== undefined ? `WALK ${x},${y},${z}` : `WALK ${x},${y}`;
        }
        else if (task === 'walk' && req.body.x !== undefined && req.body.y !== undefined) {
            const { x, y, z } = req.body;
            formattedCommand = z !== undefined ? `WALK ${x},${y},${z}` : `WALK ${x},${y}`;
        }
        else if (task === 'type' && req.body.text) {
            formattedCommand = `TYPE ${req.body.text}`;
        }
        else if (task === 'npc' && req.body.target && req.body.action) {
            formattedCommand = `NPC ${req.body.target} ${req.body.action}`;
        }
        else if (task === 'object' && req.body.target && req.body.action) {
            formattedCommand = `OBJ ${req.body.target} ${req.body.action}`;
        }
        else if (task === 'item' && req.body.target && req.body.action) {
            formattedCommand = `ITEM ${req.body.target} ${req.body.action}`;
        }
        else if (typeof task === 'string') {
            // Raw command string
            formattedCommand = task;
        }
        else {
            return res.status(400).json({
                error: 'Invalid task format',
                timestamp: new Date().toISOString(),
                expected_formats: [
                    'walk: {task: "walk", x: 100, y: 200, z: 0}',
                    'type: {task: "type", text: "hello world"}',
                    'npc: {task: "npc", target: "banker", action: "bank"}',
                    'object: {task: "object", target: "tree", action: "chop"}',
                    'item: {task: "item", target: "logs", action: "drop"}',
                    'raw: {task: "WALK 100,200"}'
                ]
            });
        }

        const newTask = {
            task_id: taskIdCounter++,
            bot_id: bot_id,
            command: formattedCommand,
            original_task: req.body,
            priority: priority,
            status: 'pending',
            created_at: new Date().toISOString(),
            assigned_at: null,
            completed_at: null
        };

        // Insert task based on priority
        if (priority === 'high') {
            taskQueue.unshift(newTask);
        } else {
            taskQueue.push(newTask);
        }

        // Keep queue size manageable
        if (taskQueue.length > 1000) {
            taskQueue = taskQueue.slice(-1000);
        }

        res.status(201).json({
            message: 'Task added successfully',
            task_id: newTask.task_id,
            command: formattedCommand,
            queue_position: priority === 'high' ? 1 : taskQueue.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Add task error:', error);
        res.status(500).json({
            error: 'Failed to add task',
            timestamp: new Date().toISOString()
        });
    }
});

// Get and remove next task from queue
tribot.get('/getUpdates', async (req, res) => {
    try {
        const { bot_id = 'default', limit = 1 } = req.query;
        
        // Update bot's last seen timestamp
        botStatus.set(bot_id, {
            ...botStatus.get(bot_id),
            last_seen: new Date().toISOString(),
            status: 'active'
        });

        // Filter tasks for specific bot or get general tasks
        let availableTasks = taskQueue.filter(task => 
            task.status === 'pending' && 
            (task.bot_id === bot_id || task.bot_id === 'default' || bot_id === 'default')
        );

        if (availableTasks.length === 0) {
            return res.json({
                tasks: [],
                queue_size: taskQueue.length,
                bot_id: bot_id,
                timestamp: new Date().toISOString()
            });
        }

        // Get up to 'limit' tasks
        const tasksToAssign = availableTasks.slice(0, parseInt(limit));
        
        // Mark tasks as assigned and remove from queue
        const assignedTasks = tasksToAssign.map(task => {
            // Remove from queue
            const index = taskQueue.findIndex(t => t.task_id === task.task_id);
            if (index !== -1) {
                taskQueue.splice(index, 1);
            }
            
            // Mark as assigned
            task.status = 'assigned';
            task.assigned_at = new Date().toISOString();
            task.assigned_to = bot_id;
            
            return {
                task_id: task.task_id,
                command: task.command,
                created_at: task.created_at,
                assigned_at: task.assigned_at
            };
        });

        res.json({
            tasks: assignedTasks,
            queue_size: taskQueue.length,
            bot_id: bot_id,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get updates error:', error);
        res.status(500).json({
            error: 'Failed to get updates',
            timestamp: new Date().toISOString()
        });
    }
});

// Mark task as completed
tribot.post('/completeTask', async (req, res) => {
    try {
        const { task_id, bot_id = 'default', result = 'success', message = '' } = req.body;
        
        if (!task_id) {
            return res.status(400).json({
                error: 'task_id is required',
                timestamp: new Date().toISOString()
            });
        }

        // Update bot status
        botStatus.set(bot_id, {
            ...botStatus.get(bot_id),
            last_seen: new Date().toISOString(),
            last_task_completed: task_id,
            last_result: result
        });

        res.json({
            message: 'Task completion recorded',
            task_id: task_id,
            result: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Complete task error:', error);
        res.status(500).json({
            error: 'Failed to record task completion',
            timestamp: new Date().toISOString()
        });
    }
});

// ===================
// QUEUE MANAGEMENT
// ===================

// Get queue status
tribot.get('/getQueueStatus', async (req, res) => {
    try {
        const { bot_id } = req.query;
        
        let filteredTasks = taskQueue;
        if (bot_id) {
            filteredTasks = taskQueue.filter(task => 
                task.bot_id === bot_id || task.bot_id === 'default'
            );
        }

        const queueStats = {
            total_tasks: filteredTasks.length,
            pending_tasks: filteredTasks.filter(t => t.status === 'pending').length,
            assigned_tasks: filteredTasks.filter(t => t.status === 'assigned').length,
            by_priority: {
                high: filteredTasks.filter(t => t.priority === 'high').length,
                normal: filteredTasks.filter(t => t.priority === 'normal').length,
                low: filteredTasks.filter(t => t.priority === 'low').length
            },
            oldest_task: filteredTasks.length > 0 ? filteredTasks[0].created_at : null,
            timestamp: new Date().toISOString()
        };

        res.json(queueStats);
    } catch (error) {
        console.error('Get queue status error:', error);
        res.status(500).json({
            error: 'Failed to get queue status',
            timestamp: new Date().toISOString()
        });
    }
});

// Clear queue
tribot.delete('/clearQueue', async (req, res) => {
    try {
        const { bot_id } = req.body;
        
        const originalSize = taskQueue.length;
        
        if (bot_id) {
            taskQueue = taskQueue.filter(task => task.bot_id !== bot_id);
        } else {
            taskQueue = [];
        }
        
        const clearedCount = originalSize - taskQueue.length;
        
        res.json({
            message: 'Queue cleared successfully',
            cleared_tasks: clearedCount,
            remaining_tasks: taskQueue.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Clear queue error:', error);
        res.status(500).json({
            error: 'Failed to clear queue',
            timestamp: new Date().toISOString()
        });
    }
});

// ===================
// BOT MANAGEMENT
// ===================

// Get bot status
tribot.get('/getBotStatus/:bot_id', async (req, res) => {
    try {
        const { bot_id } = req.params;
        
        const status = botStatus.get(bot_id);
        
        if (!status) {
            return res.status(404).json({
                error: 'Bot not found',
                bot_id: bot_id,
                timestamp: new Date().toISOString()
            });
        }

        const pendingTasks = taskQueue.filter(task => 
            task.bot_id === bot_id || task.bot_id === 'default'
        ).length;

        res.json({
            bot_id: bot_id,
            ...status,
            pending_tasks: pendingTasks,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get bot status error:', error);
        res.status(500).json({
            error: 'Failed to fetch bot status',
            timestamp: new Date().toISOString()
        });
    }
});

// Get all active bots
tribot.get('/getBots', async (req, res) => {
    try {
        const bots = Array.from(botStatus.entries()).map(([bot_id, status]) => {
            const pendingTasks = taskQueue.filter(task => 
                task.bot_id === bot_id || task.bot_id === 'default'
            ).length;

            return {
                bot_id: bot_id,
                ...status,
                pending_tasks: pendingTasks
            };
        });

        res.json({
            bots: bots,
            total_bots: bots.length,
            total_queue_size: taskQueue.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({
            error: 'Failed to fetch bots',
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint for tribot API
tribot.get('/', (req, res) => {
    res.json({
        message: 'Tribot Task Queue API',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /healthy - Health check',
            'POST /addTask - Add task to queue',
            'GET /getUpdates - Get and remove next task(s)',
            'POST /completeTask - Mark task as completed',
            'GET /getQueueStatus - Get queue statistics',
            'DELETE /clearQueue - Clear task queue',
            'GET /getBotStatus/:bot_id - Get specific bot status',
            'GET /getBots - Get all active bots'
        ],
        task_formats: [
            'walk: {task: "walk", x: 100, y: 200, z: 0}',
            'type: {task: "type", text: "hello world"}',
            'npc: {task: "npc", target: "banker", action: "bank"}',
            'object: {task: "object", target: "tree", action: "chop"}',
            'item: {task: "item", target: "logs", action: "drop"}',
            'raw: {task: "WALK 100,200"}'
        ]
    });
});

export default tribot;
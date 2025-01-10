/**
 * WebSocket Server Implementation
 *
 * This module provides real-time communication capabilities for the Agent & Swarm Platform.
 * It handles bi-directional communication between the server and clients, enabling features
 * such as live status updates, task progress monitoring, and system notifications.
 *
 * @module WebSocketServer
 */

import WebSocket from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

/**
 * WebSocketServer class extends EventEmitter to provide real-time communication.
 *
 * Features:
 * - Automatic client tracking and management
 * - Broadcast capabilities for system-wide messages
 * - Individual client messaging
 * - Graceful connection handling and cleanup
 */
export class WebSocketServer extends EventEmitter {
    /** WebSocket server instance */
    private wss: WebSocket.Server;
    /** Map of connected clients with their IDs */
    private clients: Map<string, WebSocket> = new Map();

    /**
     * Creates a new WebSocket server instance
     * @param server - HTTP server instance to attach the WebSocket server to
     */
    constructor(server: Server) {
        super();
        this.wss = new WebSocket.Server({ server });
        this.setupWebSocketServer();
    }

    /**
     * Sets up WebSocket server event handlers and connection management
     * @private
     */
    private setupWebSocketServer() {
        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = Math.random().toString(36).substring(7);
            this.clients.set(clientId, ws);

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.emit('message', { clientId, data });
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                this.clients.delete(clientId);
            });

            // Send initial connection success message
            ws.send(JSON.stringify({
                type: 'connection',
                status: 'connected',
                clientId
            }));
        });
    }

    public broadcast(data: any) {
        const message = JSON.stringify(data);
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }

    public sendTo(clientId: string, data: any) {
        const client = this.clients.get(clientId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    }

    public getConnectedClients(): number {
        return this.clients.size;
    }
}
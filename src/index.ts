import {
    VoltAgent,
    // VoltOpsClient,
    Agent,
    Memory,
    InMemoryStorageAdapter
} from '@voltagent/core';
import { PostgreSQLMemoryAdapter } from '@voltagent/postgres';
import { createPinoLogger } from '@voltagent/logger';
import { honoServer } from '@voltagent/server-hono';
import { expenseApprovalWorkflow } from './workflows';
import { weatherTool } from './tools';

const logger = createPinoLogger({
    name: 'finley',
    level: 'info'
});

const memory = new Memory({
    storage: process.env.DATABASE_URL
        ? new PostgreSQLMemoryAdapter({ connection: process.env.DATABASE_URL })
        : new InMemoryStorageAdapter()
});

const agent = new Agent({
    name: 'finley',
    instructions:
        'A helpful assistant that can check weather and help with various tasks',
    model: 'anthropic/claude-3-5-sonnet',
    tools: [weatherTool],
    memory
});

new VoltAgent({
    agents: {
        agent
    },
    workflows: {
        expenseApprovalWorkflow
    },
    server: honoServer({
        configureApp: (app) => {
            app.get('/health', (c) => c.json({ status: 'ok' }));
        }
    }),
    logger
    //   voltOpsClient: new VoltOpsClient({
    //     publicKey: process.env.VOLTAGENT_PUBLIC_KEY || "",
    //     secretKey: process.env.VOLTAGENT_SECRET_KEY || "",
    //   }),
});

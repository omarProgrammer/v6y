import { AppLogger, ServerUtils } from '@v6y/core-logic';

import createStaticAuditorApp from './app.ts';
import ServerConfig from './commons/ServerConfig.ts';

const { createServer } = ServerUtils;

const { currentConfig } = ServerConfig;
const { port, serverTimeout } = currentConfig || {};

// *********************************************** App Factory ***********************************************
// Build the Static Auditor express application (middlewares, health-check, routes).
const app = createStaticAuditorApp();

const httpServer = createServer({
    app,
    config: currentConfig,
});

// Listen on the specified port with all interfaces (0.0.0.0)
// This ensures the server is accessible from within the Docker network.
// In production, the server is exposed on a specific app port (4003) mapped to an internal port (3333)
// The .env variable V6Y_STATIC_ANALYZER_PORT is used to configure the internal port.
// It is set in each app .env file and at the env level in docker-compose.yml
// The port is crucial for internal container-to-container communication within the Docker network.
await new Promise((resolve) => httpServer.listen({ port }, () => resolve(null))); // Wait for server to start

httpServer.timeout = serverTimeout; // Set server timeout

AppLogger.info(`🚀 Server on port : ${port}`);

import { AppLogger, CorsOptions } from '@v6y/core-logic';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import expressStatusMonitor from 'express-status-monitor';

import ServerConfig from './commons/ServerConfig.ts';
import StaticAuditorRouter from './routes/StaticAuditorRouter.ts';

const { currentConfig } = ServerConfig;
const { ssl, monitoringPath, hostname, port, healthCheckPath, staticAuditorApiPath } =
    currentConfig || {};

/**
 * Builds the Static Auditor express application.
 * Extracted from index.ts so the app can be instantiated and
 * integration-tested (supertest) without binding a real port.
 */
const createStaticAuditorApp = (): express.Express => {
    const app = express();

    // *********************************************** Server Configuration ***********************************************

    // Cookie Parser: Parses cookies from incoming requests.
    app.use(cookieParser());

    // CORS (Cross-Origin Resource Sharing): Configures the server to allow requests from other origins.
    app.use(cors(CorsOptions));

    // Body Parser: Parses incoming request bodies in different formats (URL-encoded, JSON).
    app.use(bodyParser.json());

    // *********************************************** Monitoring ***********************************************

    // Express Status Monitor: Adds a monitoring dashboard accessible at the specified path.
    app.use(
        expressStatusMonitor({
            path: monitoringPath,
            healthChecks: [
                {
                    protocol: ssl ? 'https' : 'http',
                    host: hostname,
                    port,
                    path: healthCheckPath,
                },
            ],
        }),
    );

    // *********************************************** Health Check ***********************************************

    // Health Check Endpoint: Responds with "V6y Server is UP!" if the server is healthy.
    app.get(healthCheckPath, (req, res) => {
        res.status(200).send('V6y Server is UP!');
    });

    // *********************************************** App Auditor Routes ***********************************************
    app.use(staticAuditorApiPath as string, StaticAuditorRouter);

    // *********************************************** Default Route (404) ***********************************************

    // Default Route: Handles requests to unknown routes and returns a 404 Not Found response.
    app.get('*', (request, response) => {
        AppLogger.debug(`[*] KO: Requested route ${request.url} does not exist`);
        response.status(404).json({
            success: false,
            message: 'The requested route does not exist',
        });
    });

    return app;
};

export default createStaticAuditorApp;

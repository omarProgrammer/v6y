import { AppLogger } from '@v6y/core-logic';
import express from 'express';

import StaticAuditorManager from '../auditors/StaticAuditorManager.ts';
import { resolveSafeWorkspaceFolder } from '../commons/WorkspaceUtils.ts';
import AuthenticationGuard from '../middlewares/AuthenticationGuard.ts';

const { Router } = express;

const StaticAuditorRouter: express.Router = Router();

// ********************************************** Service Authentication ***********************************************
// Every /auditor endpoint requires a valid Bearer service token signed with the shared JWT_SECRET.
StaticAuditorRouter.use(AuthenticationGuard);

StaticAuditorRouter.post('/start-static-auditor.json', async (request, response) => {
    try {
        AppLogger.debug('[StaticAuditorRouter] Entering service: [start-static-auditor]');

        const { applicationId, workspaceFolder } = request.body || {};

        // ********************************************** Workspace Folder Validation ***********************************************
        // Prevent path traversal outside the shared workspace root.
        const safeWorkspaceFolder = resolveSafeWorkspaceFolder(workspaceFolder);

        if (!safeWorkspaceFolder) {
            AppLogger.error(
                `[StaticAuditorRouter] Invalid workspaceFolder received: ${workspaceFolder}`,
            );
            response.status(400).json({
                success: false,
                message: 'Invalid workspaceFolder: path escapes the workspace root',
            });
            return;
        }

        // ********************************************** Start Audits ***********************************************
        const auditsStartedSuccessfully = await StaticAuditorManager.startStaticAudit({
            applicationId,
            workspaceFolder: safeWorkspaceFolder,
        });

        // ********************************************** Server Response ***********************************************
        if (auditsStartedSuccessfully) {
            response.status(200).json({
                success: true,
                message: 'Static Code Audits have end successfully!',
            });
        } else {
            response.status(500).json({
                success: false,
                message: 'An error occurred while starting the Static Code Audits.',
            });
        }
    } catch (error) {
        AppLogger.error(
            '[StaticAuditorRouter] An exception occurred during the Static Code Audits:',
            error,
        );
        response.status(500).json({
            success: false,
            message: 'An error occurred during the Static Code Audits.',
        });
    }
});

export default StaticAuditorRouter;

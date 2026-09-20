import type { Express } from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import StaticAuditorManager from '../auditors/StaticAuditorManager.ts';

vi.mock('../auditors/StaticAuditorManager.ts', () => ({
    default: {
        startStaticAudit: vi.fn(),
    },
}));

const V6Y_STATIC_ANALYZER_API_PATH = '/api/v6y/';
const JWT_SECRET = 'static-auditor-integration-test-secret';
const SERVICE_NAME = 'v6y-bfb-main-analyzer';
const STATIC_AUDITOR_AUDIENCE = 'v6y:bfb-static-auditor';

describe('StaticAuditorApp service-to-service authentication', () => {
    let app: Express;
    let workspaceRootPath: string;
    const mockedStartStaticAudit = vi.mocked(StaticAuditorManager.startStaticAudit);

    beforeAll(async () => {
        // The workspace validation resolves folders through realpathSync, so the
        // workspace root must exist on disk for the integration tests.
        workspaceRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-workspace-root-'));
        process.env.V6Y_STATIC_ANALYZER_API_PATH = V6Y_STATIC_ANALYZER_API_PATH;
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT = workspaceRootPath;

        const { default: createStaticAuditorApp } = await import('../app.ts');

        app = createStaticAuditorApp();
    });

    afterAll(() => {
        delete process.env.V6Y_STATIC_ANALYZER_API_PATH;
        delete process.env.JWT_SECRET;
        delete process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT;
        fs.rmSync(workspaceRootPath, { recursive: true, force: true });
    });

    beforeEach(() => {
        mockedStartStaticAudit.mockReset();
    });

    it('exposes the health-check endpoint without authentication', async () => {
        await request(app).get(`${V6Y_STATIC_ANALYZER_API_PATH}health-checks`).expect(200);
    });

    it('rejects a static auditor call without an Authorization header', async () => {
        const response = await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(mockedStartStaticAudit).not.toHaveBeenCalled();
    });

    it('rejects a static auditor call with a malformed Authorization header', async () => {
        await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', 'Token abc')
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(401);
    });

    it('rejects an invalid Bearer token', async () => {
        await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', 'Bearer invalid-token')
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(401);
    });

    it('rejects a token signed with a different secret', async () => {
        const token = jwt.sign(
            { service: SERVICE_NAME, aud: STATIC_AUDITOR_AUDIENCE },
            'another-secret',
        );

        await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(401);
    });

    it('rejects with 403 a valid token signed for another service audience', async () => {
        const token = jwt.sign({ service: SERVICE_NAME, aud: 'v6y:another-service' }, JWT_SECRET);

        const response = await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(403);

        expect(response.body.success).toBe(false);
        expect(mockedStartStaticAudit).not.toHaveBeenCalled();
    });

    it('rejects with 403 a valid token without an audience claim', async () => {
        const token = jwt.sign({ service: SERVICE_NAME }, JWT_SECRET);

        const response = await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder: path.join(workspaceRootPath, 'acme', 'main'),
            })
            .expect(403);

        expect(response.body.success).toBe(false);
        expect(mockedStartStaticAudit).not.toHaveBeenCalled();
    });

    it('accepts a valid service token and starts the audits', async () => {
        mockedStartStaticAudit.mockResolvedValueOnce(true);

        const workspaceFolder = path.join(workspaceRootPath, 'acme', 'main');

        fs.mkdirSync(workspaceFolder, { recursive: true });

        const token = jwt.sign({ service: SERVICE_NAME, aud: STATIC_AUDITOR_AUDIENCE }, JWT_SECRET);

        const response = await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder,
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        // The guard resolves the folder through realpathSync before forking the workers.
        expect(mockedStartStaticAudit).toHaveBeenCalledWith({
            applicationId: 1,
            workspaceFolder: fs.realpathSync(workspaceFolder),
        });
    });

    it('rejects a workspace folder that escapes the workspace root', async () => {
        const token = jwt.sign({ service: SERVICE_NAME, aud: STATIC_AUDITOR_AUDIENCE }, JWT_SECRET);

        const response = await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder: '../../../../etc',
            })
            .expect(400);

        expect(response.body.success).toBe(false);
        expect(mockedStartStaticAudit).not.toHaveBeenCalled();
    });

    it('returns 500 when the audits could not be started', async () => {
        mockedStartStaticAudit.mockResolvedValueOnce(false);

        const workspaceFolder = path.join(workspaceRootPath, 'acme', 'main');

        fs.mkdirSync(workspaceFolder, { recursive: true });

        const token = jwt.sign({ service: SERVICE_NAME, aud: STATIC_AUDITOR_AUDIENCE }, JWT_SECRET);

        await request(app)
            .post(`${V6Y_STATIC_ANALYZER_API_PATH}auditor/start-static-auditor.json`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                applicationId: 1,
                workspaceFolder,
            })
            .expect(500);
    });
});

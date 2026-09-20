import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resolveSafeWorkspaceFolder, workspaceRoot } from '../commons/WorkspaceUtils.ts';

describe('WorkspaceUtils', () => {
    describe('workspaceRoot', () => {
        it('computes the workspace root relative to the process working directory', () => {
            expect(workspaceRoot()).toBe(path.resolve(process.cwd(), '../code-analysis-workspace'));
        });

        it('honours the V6Y_STATIC_ANALYZER_WORKSPACE_ROOT environment override', () => {
            const overriddenWorkspaceRoot = fs.mkdtempSync(
                path.join(os.tmpdir(), 'v6y-workspace-root-'),
            );

            try {
                process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT = overriddenWorkspaceRoot;

                expect(workspaceRoot()).toBe(overriddenWorkspaceRoot);

                // resolveSafeWorkspaceFolder resolves via realpathSync: the folder must exist.
                const innerFolder = path.join(overriddenWorkspaceRoot, 'acme', 'main');
                fs.mkdirSync(innerFolder, { recursive: true });

                expect(resolveSafeWorkspaceFolder(innerFolder)).toBe(fs.realpathSync(innerFolder));
            } finally {
                delete process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT;
                fs.rmSync(overriddenWorkspaceRoot, { recursive: true, force: true });
            }
        });
    });

    describe('resolveSafeWorkspaceFolder', () => {
        let workspaceRootPath: string;
        let externalFolder: string;

        beforeEach(() => {
            workspaceRootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-workspace-root-'));
            process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT = workspaceRootPath;
            externalFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-external-folder-'));
        });

        afterEach(() => {
            delete process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT;
            fs.rmSync(workspaceRootPath, { recursive: true, force: true });
            fs.rmSync(externalFolder, { recursive: true, force: true });
        });

        const createFolder = (...segments: string[]): string => {
            const folder = path.join(workspaceRootPath, ...segments);

            fs.mkdirSync(folder, { recursive: true });

            return folder;
        };

        it('returns the workspace root when no workspace folder is provided', () => {
            const fsWorkspaceRootPath = fs.realpathSync(workspaceRootPath);

            expect(resolveSafeWorkspaceFolder()).toBe(fsWorkspaceRootPath);
            expect(resolveSafeWorkspaceFolder('')).toBe(fsWorkspaceRootPath);
            expect(resolveSafeWorkspaceFolder(null)).toBe(fsWorkspaceRootPath);
        });

        it('returns the canonical workspace root itself when passed', () => {
            const fsWorkspaceRootPath = fs.realpathSync(workspaceRootPath);

            expect(resolveSafeWorkspaceFolder(fsWorkspaceRootPath)).toBe(fsWorkspaceRootPath);
        });

        it('resolves a relative folder located inside the workspace root', () => {
            const innerFolder = createFolder('acme', 'main');
            const relativeFolder = path.relative(process.cwd(), innerFolder);

            expect(resolveSafeWorkspaceFolder(relativeFolder)).toBe(fs.realpathSync(innerFolder));
        });

        it('accepts an absolute folder located inside the workspace root', () => {
            const absoluteWorkspaceFolder = createFolder('acme', 'main');

            expect(resolveSafeWorkspaceFolder(absoluteWorkspaceFolder)).toBe(
                fs.realpathSync(absoluteWorkspaceFolder),
            );
        });

        it('rejects a folder that escapes the workspace root', () => {
            expect(resolveSafeWorkspaceFolder('../../../../etc')).toBeNull();
            expect(resolveSafeWorkspaceFolder('/etc')).toBeNull();
        });

        it('rejects a non-existent folder even when it is lexically inside the workspace root', () => {
            const missingFolder = path.join(workspaceRootPath, 'acme', 'not-created-yet');

            expect(resolveSafeWorkspaceFolder(missingFolder)).toBeNull();
        });

        it('rejects a symlink inside the workspace root pointing outside of it', () => {
            const symlink = path.join(workspaceRootPath, 'escape-link');

            fs.symlinkSync(externalFolder, symlink, 'dir');

            expect(resolveSafeWorkspaceFolder(symlink)).toBeNull();
        });

        it('rejects a symlink inside the workspace root pointing to a non-existent target', () => {
            const symlink = path.join(workspaceRootPath, 'dangling-link');

            fs.symlinkSync(path.join(externalFolder, 'does-not-exist'), symlink, 'dir');

            expect(resolveSafeWorkspaceFolder(symlink)).toBeNull();
        });

        it('accepts a symlink inside the workspace root pointing to another folder inside the root', () => {
            const realInner = createFolder('real', 'project');
            const symlink = path.join(workspaceRootPath, 'alias');

            fs.symlinkSync(realInner, symlink, 'dir');

            expect(resolveSafeWorkspaceFolder(symlink)).toBe(fs.realpathSync(realInner));
        });
    });
});

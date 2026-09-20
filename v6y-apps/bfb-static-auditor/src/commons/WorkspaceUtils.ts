import fs from 'fs';
import path from 'path';

const DEFAULT_WORKSPACE_RELATIVE_DIR = '../code-analysis-workspace';

/**
 * Computes the workspace root directory shared by the auditors.
 * Mirrors the workspace layout produced by ZipUtils.unZipFile (ZIP_BASE_DIR).
 * The V6Y_STATIC_ANALYZER_WORKSPACE_ROOT environment variable overrides the
 * default document root (useful for tests and sandboxed deployments).
 */
export const workspaceRoot = (): string => {
    const overriddenWorkspaceRoot = process.env.V6Y_STATIC_ANALYZER_WORKSPACE_ROOT;

    if (overriddenWorkspaceRoot?.length) {
        return path.resolve(overriddenWorkspaceRoot);
    }

    return path.resolve(process.cwd(), DEFAULT_WORKSPACE_RELATIVE_DIR);
};

/**
 * Resolves the given workspace folder and rejects any path that escapes the
 * workspace root (path traversal protection).
 *
 * Both the workspace root and the candidate folder are resolved with
 * realpathSync (symlinks fully resolved) before the contiguity check is
 * re-applied. This blocks `..`/absolute paths outside the root, symlink-escape
 * (a symlink planted inside the root pointing outside it) and non-existent
 * folders (realpathSync throws ENOENT): those reject with null.
 *
 * Returns the canonical (symlink-resolved) workspace root when no folder is
 * provided, or the canonical candidate folder when it is safe; null otherwise.
 * @param workspaceFolder
 */
export const resolveSafeWorkspaceFolder = (workspaceFolder?: string | null): string | null => {
    let realWorkspaceRoot: string;

    try {
        realWorkspaceRoot = fs.realpathSync(path.normalize(workspaceRoot()));
    } catch {
        // The workspace root does not exist: nothing can be resolved safely.
        return null;
    }

    if (!workspaceFolder?.length) {
        return realWorkspaceRoot;
    }

    const absoluteWorkspaceFolder = path.isAbsolute(workspaceFolder)
        ? workspaceFolder
        : path.resolve(process.cwd(), workspaceFolder);

    const normalizedWorkspaceFolder = path.normalize(absoluteWorkspaceFolder);

    let realWorkspaceFolder: string;

    try {
        // realpathSync resolves every symlink and throws ENOENT when the folder
        // does not exist: both the symlink-escape and the missing-folder cases are rejected.
        realWorkspaceFolder = fs.realpathSync(normalizedWorkspaceFolder);
    } catch {
        return null;
    }

    const rootWithSeparator = realWorkspaceRoot.endsWith(path.sep)
        ? realWorkspaceRoot
        : `${realWorkspaceRoot}${path.sep}`;

    if (
        realWorkspaceFolder === realWorkspaceRoot ||
        realWorkspaceFolder.startsWith(rootWithSeparator)
    ) {
        return realWorkspaceFolder;
    }

    return null;
};

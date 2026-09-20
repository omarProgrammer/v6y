import { AppLogger } from '@v6y/core-logic';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const BEARER_TOKEN_PREFIX = 'Bearer ';
const STATIC_AUDITOR_AUDIENCE = 'v6y:bfb-static-auditor';

export type ServiceTokenVerificationResult = { valid: true } | { valid: false; status: 401 | 403 };

/**
 * Verifies that the given token is a valid JWT signed with the shared JWT_SECRET
 * and issued for the static auditor audience (aud = 'v6y:bfb-static-auditor').
 *
 * Only the HS256 algorithm is accepted (the signing algorithm is pinned to
 * prevent algorithm-confusion attacks).
 *
 * A two-step verification distinguishes:
 * - 401: the token is absent, malformed, expired or signed with a wrong secret;
 * - 403: the signature is valid but the audience claim is missing or does not
 *   match the static auditor audience (token issued for another service).
 *
 * Throws when the JWT_SECRET environment variable is missing.
 * @param token
 */
export const verifyServiceToken = (token: string): ServiceTokenVerificationResult => {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        throw new Error(
            '[AuthenticationGuard - verifyServiceToken] JWT_SECRET is not defined in the environment variables',
        );
    }

    const verifyOptions: jwt.VerifyOptions = { algorithms: ['HS256'] };

    try {
        // Signature validation (HS256, expiry): rejects malformed/expired/wrongly signed tokens.
        jwt.verify(token, jwtSecret, verifyOptions);
    } catch {
        return { valid: false, status: 401 };
    }

    try {
        // Audience validation: the token is correctly signed but was not issued
        // for the static auditor service -> authenticated but not authorized.
        jwt.verify(token, jwtSecret, { ...verifyOptions, audience: STATIC_AUDITOR_AUDIENCE });

        return { valid: true };
    } catch {
        return { valid: false, status: 403 };
    }
};

const respondWithUnauthorized = (response: Response, message: string): void => {
    response.status(401).json({
        success: false,
        message,
    });
};

const respondWithForbidden = (response: Response, message: string): void => {
    response.status(403).json({
        success: false,
        message,
    });
};

/**
 * Express middleware securing the static auditor service-to-service endpoints.
 * Requests must carry a Bearer service token signed with the shared JWT_SECRET.
 */
const AuthenticationGuard = (request: Request, response: Response, next: NextFunction): void => {
    try {
        const authorizationHeader = request.headers.authorization;

        if (!authorizationHeader?.startsWith(BEARER_TOKEN_PREFIX)) {
            respondWithUnauthorized(response, 'Missing or malformed Authorization header');
            return;
        }

        const token = authorizationHeader.substring(BEARER_TOKEN_PREFIX.length);

        const verification = verifyServiceToken(token);

        if (!verification.valid) {
            if (verification.status === 403) {
                AppLogger.error(
                    '[AuthenticationGuard] Service token is not authorized for the static auditor audience',
                );
                respondWithForbidden(response, 'Service token is not authorized for this service');
            } else {
                AppLogger.error('[AuthenticationGuard] Invalid or expired service token');
                respondWithUnauthorized(response, 'Invalid or expired service token');
            }
            return;
        }

        AppLogger.debug('[AuthenticationGuard] Service token successfully verified');
        next();
    } catch (error) {
        AppLogger.error('[AuthenticationGuard] Service authentication failed:', error);
        respondWithUnauthorized(response, 'Invalid or expired service token');
    }
};

export default AuthenticationGuard;

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export function requireAuth(config) {
  return asyncHandler(async (request, _response, next) => {
    const header = request.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'A bearer access token is required.');
    }

    let payload;
    try {
      payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(401, 'TOKEN_EXPIRED', 'The access token has expired.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(401, 'INVALID_TOKEN', 'The access token is invalid.');
      }
      throw error;
    }

    const user = await User.findById(payload.sub).select('+tokenVersion');
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new AppError(401, 'INVALID_SESSION', 'This session is no longer active.');
    }
    request.user = user;
    return next();
  });
}

export function requireRole(...roles) {
  return function authorizeRole(request, _response, next) {
    if (!request.user || !roles.includes(request.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'));
    }
    return next();
  };
}

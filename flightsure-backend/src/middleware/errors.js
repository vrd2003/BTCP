import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/respond.js';

export function notFound(_request, _response, next) {
  next(new AppError(404, 'NOT_FOUND', 'The requested API resource does not exist.'));
}

export function errorHandler(error, request, response, _next) {
  if (response.headersSent) return;
  if (error?.type === 'entity.parse.failed') {
    return sendError(response, 400, 'INVALID_JSON', 'Request body must contain valid JSON.');
  }
  if (error?.name === 'ValidationError') {
    return sendError(response, 400, 'DATABASE_VALIDATION_ERROR', 'The data did not pass validation.');
  }
  if (error?.code === 11000) {
    return sendError(response, 409, 'DUPLICATE_RESOURCE', 'A record with the same unique value already exists.');
  }
  if (error?.name === 'CastError') {
    return sendError(response, 400, 'INVALID_IDENTIFIER', 'The requested identifier is invalid.');
  }

  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.code || 'INTERNAL_ERROR';
  const message = status >= 500 && !(error instanceof AppError)
    ? 'The server could not complete the request.'
    : error.message;
  if (status >= 500) {
    request.log?.error({ err: error }, 'Request failed');
  }
  return sendError(response, status, code, message, error?.details);
}

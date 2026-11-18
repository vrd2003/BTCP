import { randomUUID } from 'node:crypto';

export function requestContext(request, response, next) {
  const startedAt = performance.now();
  request.id = randomUUID();
  response.setHeader('X-Request-Id', request.id);
  response.once('finish', () => {
    console.log(JSON.stringify({
      level: 'info',
      requestId: request.id,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt)
    }));
  });
  next();
}

export function rejectMongoOperators(request, _response, next) {
  if (containsMongoOperator(request.body)) {
    const error = new Error('Request body contains unsupported query operators.');
    error.status = 400;
    error.code = 'INVALID_REQUEST_BODY';
    return next(error);
  }
  return next();
}

function containsMongoOperator(value) {
  if (!value || typeof value !== 'object') return false;
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (containsMongoOperator(nested)) return true;
  }
  return false;
}

import { AppError } from '../utils/errors.js';

export function validate(schema, source = 'body') {
  return function validateRequest(request, _response, next) {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'The request did not pass validation.', result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message
      }))));
    }
    if (source === 'query') {
      request.validatedQuery = result.data;
    } else {
      request[source] = result.data;
    }
    return next();
  };
}

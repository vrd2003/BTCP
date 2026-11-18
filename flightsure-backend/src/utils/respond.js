export function sendSuccess(response, status, message, data) {
  return response.status(status).json({ success: true, message, data });
}

export function sendError(response, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return response.status(status).json({ success: false, error });
}

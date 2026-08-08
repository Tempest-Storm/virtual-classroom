export function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(err, req, res, _next) {
  const isProd = process.env.NODE_ENV === 'production';

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])),
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: `Duplicate value for ${Object.keys(err.keyValue).join(', ')}` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }

  const status = err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    message: status >= 500 && isProd ? 'Something went wrong' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

/** Wraps async handlers so rejected promises reach errorHandler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

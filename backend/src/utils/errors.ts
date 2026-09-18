export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: unknown) {
    super(404, "NOT_FOUND", message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message = "Semantic validation failed", details?: unknown) {
    super(422, "UNPROCESSABLE_ENTITY", message, details);
  }
}

export class InsufficientQuestionsError extends AppError {
  constructor(available: number, requested: number) {
    super(
      422,
      "INSUFFICIENT_QUESTIONS",
      `Only ${available} questions available, ${requested} requested.`
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHORIZED", message = "Authentication required", details?: unknown) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied", details?: unknown) {
    super(403, "FORBIDDEN", message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: unknown) {
    super(409, "CONFLICT", message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = "Too many requests. Please try again later.", details?: unknown) {
    super(429, "TOO_MANY_REQUESTS", message, details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected server error occurred", details?: unknown) {
    super(500, "INTERNAL_SERVER_ERROR", message, details);
  }
}

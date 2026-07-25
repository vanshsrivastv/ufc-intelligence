import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

// Catches everything, not just HttpException, so an unexpected error never
// leaks a raw stack trace to the client — it always gets normalized into
// the same { statusCode, message, error } shape described in architecture.md §11.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = isHttpException
      ? exception.getResponse()
      : "Internal server error";

    if (!isHttpException) {
      // Only log unexpected errors verbosely — expected 4xx responses
      // (validation errors, not-found) aren't worth the noise.
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      message: typeof message === "string" ? message : (message as { message: unknown }).message ?? message,
      error: isHttpException ? exception.name : "InternalServerError",
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}

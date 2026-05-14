export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly errors: unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
  }
}

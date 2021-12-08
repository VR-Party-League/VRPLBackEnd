export class CustomError extends Error {
  code: number = 500;
  message: string = this.message;
}
export class UnauthorizedError extends CustomError {
  code: number = 401;
  message: string = this.message || "Unauthorized";
}
export class BadRequestError extends CustomError {
  code = 400;
  message: string = this.message || "Bad request";
}
export class InternalServerError extends CustomError {
  code = 500;
  message: string = this.message || "Internal server error";
}
export class ForbiddenError extends CustomError {
  code = 403;
  message: string = this.message || "Forbidden";
}

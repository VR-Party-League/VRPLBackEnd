export class CustomError extends Error {
  code: number = 501;
  message: string = this.message || "Internal server error";
}

export class BadRequestError extends Error {
  code = 401;
  message: string = this.message || "Bad request";
}

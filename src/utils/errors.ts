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

export class PlayerNotFoundError extends CustomError {
  code = 400;
  message: string = this.message || "Player not found";
}

export class TeamNotFoundError extends CustomError {
  code = 400;
  message: string = this.message || "Team not found";
}

export class TournamentNotFoundError extends CustomError {
  code = 400;
  message: string = this.message || "Tournament not found";
}

export class InvalidScopeError extends CustomError {
  code = 400;
  message: string = this.message || "Invalid scope";
}

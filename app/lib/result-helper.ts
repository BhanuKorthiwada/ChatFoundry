enum StatusCode {
  Success = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  ServerError = 500,
  Conflict = 409,
}

interface SuccessResponse<T> {
  status: StatusCode;
  value: T;
  message?: string;
  isSuccess: true;
}

interface ErrorResponse {
  status: StatusCode;
  message: string;
  errorDetails?: unknown;
  isSuccess: false;
}

export class Result<T> {
  private readonly _response: SuccessResponse<T> | ErrorResponse;

  private constructor(response: SuccessResponse<T> | ErrorResponse) {
    this._response = response;
  }

  public get isSuccess(): boolean {
    return this._response.isSuccess;
  }

  public get isFailure(): boolean {
    return !this._response.isSuccess;
  }

  public get response(): SuccessResponse<T> | ErrorResponse {
    return this._response;
  }

  public get value(): T | undefined {
    return this.isSuccess ? (this._response as SuccessResponse<T>).value : undefined;
  }

  public get error(): string | undefined {
    return this.isFailure ? (this._response as ErrorResponse).message : undefined;
  }

  public get message(): string | undefined {
    return this._response.message;
  }

  public get status(): StatusCode {
    return this._response.status;
  }

  public get errorDetails(): unknown | undefined {
    return this.isFailure ? (this._response as ErrorResponse).errorDetails : undefined;
  }

  public static ok<U>(value: U, message?: string): Result<U> {
    return new Result<U>({
      status: StatusCode.Success,
      value,
      message,
      isSuccess: true,
    });
  }

  public static created<U>(value: U, message?: string): Result<U> {
    return new Result<U>({
      status: StatusCode.Created,
      value,
      message,
      isSuccess: true,
    });
  }

  private static fail<U>(status: StatusCode, message: string, errorDetails?: unknown): Result<U> {
    return new Result<U>({
      status,
      message,
      errorDetails,
      isSuccess: false,
    });
  }

  public static notFound<U>(message = "Resource not found"): Result<U> {
    return Result.fail<U>(StatusCode.NotFound, message);
  }

  public static badRequest<U>(message: string, errorDetails?: unknown): Result<U> {
    return Result.fail<U>(StatusCode.BadRequest, message, errorDetails);
  }

  public static unauthorized<U>(message = "Unauthorized"): Result<U> {
    return Result.fail<U>(StatusCode.Unauthorized, message);
  }

  public static forbidden<U>(message = "Forbidden"): Result<U> {
    return Result.fail<U>(StatusCode.Forbidden, message);
  }

  public static conflict<U>(message: string, errorDetails?: unknown): Result<U> {
    return Result.fail<U>(StatusCode.Conflict, message, errorDetails);
  }

  public static serverError<U>({
    message = "Server error",
    exception,
    errorDetails,
  }: {
    message?: string;
    exception?: unknown;
    errorDetails?: unknown;
  }): Result<U> {
    console.error(`Internal Server Error: ${message}`, exception, errorDetails);
    return Result.fail<U>(StatusCode.ServerError, message, errorDetails);
  }
}

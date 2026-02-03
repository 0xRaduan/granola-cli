export class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

export function isCliError(err: unknown): err is CliError {
  return err instanceof CliError && typeof err.exitCode === 'number';
}

export class MissingConfigError extends Error {
  constructor(name: string) {
    super(`Missing required environment variable: ${name}`);
    this.name = "MissingConfigError";
  }
}

export function requireServerEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new MissingConfigError(name);
  }

  return value;
}

export function isMissingConfigError(error: unknown) {
  return error instanceof MissingConfigError;
}

export type SessionErrorLike = {
  name?: string;
  status?: number;
};

export function isInvalidSession(error: SessionErrorLike): boolean {
  return (
    error.name === "AuthSessionMissingError" ||
    error.status === 400 ||
    error.status === 401
  );
}

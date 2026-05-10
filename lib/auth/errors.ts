/**
 * Auth-related errors. Plain module (NOT a "use server" file) so we
 * can export classes and constants.
 */

export class AuthorizationError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message)
    this.name = "AuthorizationError"
  }
}

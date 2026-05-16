/**
 * Strip every character that is not printable ASCII (space through tilde).
 * Used to prevent Hebrew / RTL letters from sneaking into auth fields
 * (username, password) where they cause silent login failures.
 */
export function asciiOnly(value: string): string {
  return value.replace(/[^\x20-\x7E]/g, "")
}

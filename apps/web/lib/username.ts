// 3-20 chars, letters/numbers/underscore only, must start with a letter
// - shared between signup and the account-settings update so both
// surfaces reject the exact same set of usernames.
const USERNAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return "Username must be 3-20 characters, start with a letter, and contain only letters, numbers, and underscores.";
  }
  return null;
}

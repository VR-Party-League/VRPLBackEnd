export const MAX_PLAYER_NAME_LENGTH = 18;
export const MIN_PLAYER_NAME_LENGTH = 4;

export function cleanNameForChecking(name: string) {
  const newName = name
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/\W/g, "");
  return newName;
}

export function cleanNameFromInput(name: string) {
  if (name.length < MIN_PLAYER_NAME_LENGTH)
    name = name.padEnd(MIN_PLAYER_NAME_LENGTH, "-");
  const newName = name
    .trim()
    .replace(/\s+/g, "__WHITE__SPACE__")
    .replace(/\W/g, "")
    .replace(/__WHITE__SPACE__/g, " ");
  if (newName.length > MAX_PLAYER_NAME_LENGTH) {
    return newName.substring(0, MAX_PLAYER_NAME_LENGTH);
  }
  return newName;
}

export function isValidEmailRegex(email: string): boolean {
  const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRegex.test(email);
}

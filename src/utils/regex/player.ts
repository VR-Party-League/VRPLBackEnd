export const MAX_PLAYER_NAME_LENGTH = 18;
export function cleanNameForChecking(name: string) {
  const newName = name
    .trim()
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/\W/g, "");
  return newName;
}

export function cleanNameFromInput(name: string) {
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

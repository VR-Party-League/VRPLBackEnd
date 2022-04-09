export function convertSiteInput(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

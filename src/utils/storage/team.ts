import { BlobSASPermissions } from "@azure/storage-blob";
import ms from "ms";
import { allBlobs, containerClient, refreshAllAvatars } from ".";
const perms = new BlobSASPermissions();
perms.read = true;

export interface teamAvatarData {
  createdAt: number;
  url: string;
}
const teamAvatarCache = new Map<string, teamAvatarData>();

function createBlobName(teamId: string): string {
  return `teams/${teamId}.png`;
}

async function fetchTeamAvatar(teamId: string): Promise<string> {
  const blockBlobClient = containerClient.getBlobClient(createBlobName(teamId));
  const url = await blockBlobClient.generateSasUrl({
    expiresOn: new Date(Date.now() + ms("30m")),
    permissions: perms,
  });
  return url;
}

export async function getTeamAvatar(teamId: string) {
  await refreshAllAvatars();
  if (!allBlobs.has(createBlobName(teamId))) return undefined;

  const foundItem = teamAvatarCache.get(teamId);
  if (!foundItem || foundItem.createdAt + ms("20m") < Date.now()) {
    const url = await fetchTeamAvatar(teamId);
    teamAvatarCache.set(teamId, { createdAt: Date.now(), url: url });
    return url;
  }
  return foundItem.url;
}

export async function uploadAvatar(userId: string, fileData: Buffer) {
  const blobName = createBlobName(userId);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadData(fileData);
  if (!allBlobs.has(createBlobName(userId)))
    allBlobs.add(createBlobName(userId));
  return uploadBlobResponse;
}
export async function removeAvatar(userId: string) {
  const blobName = createBlobName(userId);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const deleteBlobResponse = await blockBlobClient.deleteIfExists();
  allBlobs.delete(createBlobName(userId));
  return deleteBlobResponse;
}

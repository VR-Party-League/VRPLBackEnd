import { BlobSASPermissions } from "@azure/storage-blob";
import ms from "ms";
import { allBlobs, containerClient, refreshAllAvatars } from ".";
const perms = new BlobSASPermissions();
perms.read = true;

export interface playerAvatarData {
  createdAt: number;
  url: string;
}
const playerAvatarCache = new Map<string, playerAvatarData>();

function createBlobName(userId: string): string {
  return `players/${userId}.png`;
}

async function fetchPlayerAvatar(userId: string): Promise<string> {
  const blockBlobClient = containerClient.getBlobClient(createBlobName(userId));
  const url = await blockBlobClient.generateSasUrl({
    expiresOn: new Date(Date.now() + ms("30m")),
    permissions: perms,
  });
  return url;
}

export async function getPlayerAvatar(userId: string) {
  await refreshAllAvatars();
  if (!allBlobs.has(createBlobName(userId))) return undefined;

  const foundItem = playerAvatarCache.get(userId);
  if (!foundItem || foundItem.createdAt + ms("20m") < Date.now()) {
    const url = await fetchPlayerAvatar(userId);
    playerAvatarCache.set(userId, { createdAt: Date.now(), url: url });
    return url;
  }
  return foundItem.url;
}

export async function uploadAvatar(userId: string, fileData: Buffer) {
  const blobName = createBlobName(userId);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadData(fileData);
  if (!allBlobs.has(userId)) allBlobs.add(userId);
  return uploadBlobResponse;
}
export async function removeAvatar(userId: string) {
  await refreshAllAvatars();
  if (!allBlobs.has(createBlobName(userId))) return undefined;

  const blobName = createBlobName(userId);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const deleteBlobResponse = await blockBlobClient.deleteIfExists();
  allBlobs.delete(userId);
  playerAvatarCache.delete(userId);
  return deleteBlobResponse;
}

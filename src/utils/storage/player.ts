import { BlobSASPermissions } from "@azure/storage-blob";
import ms from "ms";
import path from "path";
import { containerClient } from ".";
import fs from "fs/promises";
const perms = new BlobSASPermissions();
perms.read = true;

export interface playerAvatarData {
  createdAt: number;
  url: string;
}
const playerAvatarCache = new Map<string, playerAvatarData>();
const allBlobs = new Set<string>();

function createBlobName(userId: string): string {
  return `players/${userId}.png`;
}
function getIdFromBlobName(blobName: string): string {
  return blobName.substr("players/".length, "players/".length);
}
// TODO: Make a set of all blobs and then read if the blob exists, if not, return false, and if it does, fetch it and return it

async function uploadAvatar(userId: string, fileData: Buffer) {
  const blobName = createBlobName(userId);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadData(fileData);
  console.log(uploadBlobResponse);
}
async function listAllAvatars() {
  const newSet = new Set<string>();
  for await (const blob of containerClient.listBlobsFlat()) {
    // if(!blob.deleted)
    //   newSet.add(getIdFromBlobName())
  }
}
async function fetchPlayerAvatar(userId: string): Promise<string> {
  const blockBlobClient = containerClient.getBlobClient(createBlobName(userId));
  //blockBlobClient.
  const url = await blockBlobClient.generateSasUrl({
    expiresOn: new Date(Date.now() + ms("30m")),
    permissions: perms,
  });
  return url;
}

export async function getPlayerAvatar(userId: string) {
  const foundItem = playerAvatarCache.get(userId);
  if (!foundItem || foundItem.createdAt + ms("20m") < Date.now()) {
    const url = await fetchPlayerAvatar(userId);
    playerAvatarCache.set(userId, { createdAt: Date.now(), url: url });
    return url;
  }
  return foundItem.url;
}

// (async () => {
//   console.time("list");
//   await listAllAvatars();
//   console.timeEnd("list");
//   //
//   console.time("readAvatar");
//   const file = await fs.readFile(
//     path.join(process.cwd(), "NEPA-Raptors-Disc.png")
//   );
//   console.timeEnd("readAvatar");
//   //
//   console.time("uploadAvatar");
//   await uploadAvatar("1ed2da58-939c-4205-9b0d-b44364499c98", file);
//   console.timeEnd("uploadAvatar");

//   console.time("getAvatar");
//   const url = await getPlayerAvatar("1ed2da58-939c-4205-9b0d-b44364499c98");
//   console.timeEnd("getAvatar");
//   console.log(url);

//   console.time("getAvatar2");
//   const url2 = await getPlayerAvatar("1ed2da58-939c-4205-9b0d-b44364499c98");
//   console.timeEnd("getAvatar2");
//   console.log(url2);
// })();

import {
  BlobDeleteIfExistsResponse,
  BlobSASPermissions,
  BlobServiceClient,
  BlockBlobUploadResponse,
} from "@azure/storage-blob";
import ms from "ms";
import { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path/posix";

const AZURE_STORAGE_CONNECTION_STRING = process.env
  .AZURE_STORAGE_CONNECTION_STRING as string;

const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING
);

const containerName = "pictures";
export const containerClient =
  blobServiceClient.getContainerClient(containerName);

// TODO: Does this need to cache everything? or was i being dummy again
export let allBlobs = new Set<string>();
let lastAvatarRefresh = 0;
export async function refreshAllAvatars() {
  if (lastAvatarRefresh + ms("6h") < Date.now()) {
    lastAvatarRefresh = Date.now();
    const newSet = new Set<string>();
    for await (const blob of containerClient.listBlobsFlat()) {
      if (!blob.deleted) {
        newSet.add(blob.name);
      }
    }
    allBlobs = newSet;
  }
}

export interface avatarData {
  createdAt: number;
  url: string;
}
const avatarCache = new Map<string, avatarData>();

function createPlayerBlobName(userId: string): string {
  return `players/${userId}.png`;
}
function createTeamBlobName(tournamentId: string, teamId: string): string {
  return `tournaments/${tournamentId}/teams/${teamId}.png`;
}
function createBlobName(forWho: "team", id: string, tourneyId: string): string;
function createBlobName(forWho: "player", id: string): string;
function createBlobName(
  forWho: "player" | "team",
  id: string,
  tourneyId?: string
): string {
  if (forWho === "player") return createPlayerBlobName(id);
  else return createTeamBlobName(id, tourneyId!);
}

async function fetchAvatar(blobName: string): Promise<string> {
  const perms = new BlobSASPermissions();
  perms.read = true;
  const blockBlobClient = containerClient.getBlobClient(blobName);
  const url = await blockBlobClient.generateSasUrl({
    expiresOn: new Date(Date.now() + ms("30m")),
    permissions: perms,
  });
  return url;
}

// Get avatar
export async function getAvatar(
  forWho: "player",
  id: string
): Promise<string | undefined>;
export async function getAvatar(
  forWho: "team",
  id: string,
  tourneyId: string
): Promise<string | undefined>;
export async function getAvatar(
  forWho: "player" | "team",
  id: string,
  tourneyId?: string
): Promise<string | undefined> {
  await refreshAllAvatars();
  let blobName: string;
  if (forWho === "team") blobName = createBlobName(forWho, id, tourneyId!);
  else blobName = createBlobName(forWho, id);
  if (!allBlobs.has(blobName)) return undefined;

  const foundItem = avatarCache.get(blobName);
  if (!foundItem || foundItem.createdAt + ms("20m") < Date.now()) {
    const url = await fetchAvatar(blobName);
    avatarCache.set(blobName, { createdAt: Date.now(), url: url });
    console.log("Fetched item", url);
    return url;
  }
  console.log("Cached item", foundItem.url, foundItem);
  return foundItem.url;
}

// Upload avatar
export async function uploadAvatar(
  forWho: "player",
  id: string,
  fileData: Buffer
): Promise<BlockBlobUploadResponse>;
export async function uploadAvatar(
  forWho: "team",
  id: string,
  fileData: Buffer,
  tourneyId: string
): Promise<BlockBlobUploadResponse>;
export async function uploadAvatar(
  forWho: "player" | "team",
  id: string,
  fileData: Buffer,
  tourneyId?: string
) {
  let blobName: string;
  if (forWho === "team") blobName = createBlobName(forWho, id, tourneyId!);
  else blobName = createBlobName(forWho, id);

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadData(fileData);
  if (!allBlobs.has(blobName)) allBlobs.add(blobName);
  return uploadBlobResponse;
}

// Remove Avatar
export async function removeAvatar(
  forWho: "player",
  id: string
): Promise<BlobDeleteIfExistsResponse>;
export async function removeAvatar(
  forWho: "team",
  id: string,
  tourneyId: string
): Promise<BlobDeleteIfExistsResponse>;
export async function removeAvatar(
  forWho: "player" | "team",
  id: string,
  tourneyId?: string
): Promise<BlobDeleteIfExistsResponse> {
  let blobName: string;
  if (forWho === "team") blobName = createBlobName(forWho, id, tourneyId!);
  else blobName = createBlobName(forWho, id);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const deleteBlobResponse = await blockBlobClient.deleteIfExists();
  allBlobs.delete(blobName);
  avatarCache.delete(blobName);
  return deleteBlobResponse;
}

// TODO: Log changing avatars

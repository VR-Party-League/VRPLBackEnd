import {
  BlobDeleteIfExistsResponse,
  BlobServiceClient,
  BlockBlobUploadResponse,
} from "@azure/storage-blob";
import ms from "ms";
import { BadRequestError } from "../errors";

const AZURE_STORAGE_CONNECTION_STRING = process.env
  .AZURE_STORAGE_CONNECTION_STRING as string;
if (!AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
}
const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING
);

const containerName = "pictures";
export const containerClient =
  blobServiceClient.getContainerClient(containerName);

// TODO: Does this need to cache everything? or was i being dummy again
let allBlobs = new Set<string>();
let lastBlobRefresh = 0;

export async function refreshAllAvatars() {
  if (lastBlobRefresh + ms("24h") < Date.now()) {
    lastBlobRefresh = Date.now();
    const newSet = new Set<string>();
    for await (const blob of containerClient.listBlobsFlat()) {
      if (!blob.deleted) {
        newSet.add(blob.name);
      }
    }
    allBlobs = newSet;
  }
}

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
  return `${containerClient.url}/${blobName}`;
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

  if (!allBlobs.delete(blobName))
    throw new BadRequestError("No avatar to be removed");

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  return await blockBlobClient.deleteIfExists();
}

// TODO: Log changing avatars

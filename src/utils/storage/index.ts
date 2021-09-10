import { BlobSASPermissions, BlobServiceClient } from "@azure/storage-blob";
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

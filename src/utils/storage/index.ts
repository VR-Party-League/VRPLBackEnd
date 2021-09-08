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

import {
  BlobServiceClient,
  BlockBlobUploadHeaders,
  BlockBlobUploadResponse,
  HttpOperationResponse,
} from "@azure/storage-blob";
import ms from "ms";
import crypto from "crypto";
import { setPlayerAvatarHash } from "../../db/player";
import { VrplPlayer, isPlayer } from "../../db/models/vrplPlayer";
import { VrplTeam } from "../../db/models/vrplTeam";
import { setTeamAvatarHash } from "../../db/team";

function getBufferHash(buffer: Buffer): string {
  const hash = crypto.createHash("SHA1");
  hash.update(buffer);
  return Buffer.from(hash.digest("hex"), "hex").toString("base64url");
}

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

function createPlayerBlobName(userId: string, hash: string): string {
  return `players/${userId}/${hash}.png`;
}

function createTeamBlobName(
  tournamentId: string,
  hash: string,
  teamId: string
): string {
  return `tournaments/${tournamentId}/teams/${teamId}/${hash}.png`;
}

function createBlobName(
  forWho: "team",
  id: string,
  hash: string,
  tourneyId: string
): string;
function createBlobName(forWho: "player", id: string, hash: string): string;
function createBlobName(
  forWho: "player" | "team",
  id: string,
  hash: string,
  tourneyId?: string
): string {
  if (forWho === "player") return createPlayerBlobName(id, hash);
  else return createTeamBlobName(id, hash, tourneyId!);
}

// Get avatar
export async function getAvatar(
  forWho: "player",
  id: string,
  hash: string
): Promise<string | undefined>;
export async function getAvatar(
  forWho: "team",
  id: string,
  hash: string,
  tourneyId: string
): Promise<string | undefined>;
export async function getAvatar(
  forWho: "player" | "team",
  id: string,
  hash: string,
  tourneyId?: string
): Promise<string | undefined> {
  await refreshAllAvatars();
  let blobName: string;
  if (forWho === "team")
    blobName = createBlobName(forWho, id, hash, tourneyId!);
  else blobName = createBlobName(forWho, id, hash);
  if (!allBlobs.has(blobName)) return undefined;
  return `${containerClient.url}/${blobName}`;
}

export async function uploadAvatar(
  player: VrplPlayer,
  fileData: Buffer,
  performedById: string
): Promise<
  (BlockBlobUploadHeaders & { _response: HttpOperationResponse }) | undefined
>;
export async function uploadAvatar(
  team: VrplTeam,
  fileData: Buffer,
  performedById: string
): Promise<
  (BlockBlobUploadHeaders & { _response: HttpOperationResponse }) | undefined
>;
export async function uploadAvatar(
  teamOrPlayer: VrplPlayer | VrplTeam,
  fileData: Buffer,
  performedById: string
): Promise<
  (BlockBlobUploadHeaders & { _response: HttpOperationResponse }) | undefined
> {
  let imgHash = getBufferHash(fileData);
  if (teamOrPlayer.avatarHash === imgHash) return undefined;
  let blobName: string;
  if (isPlayer(teamOrPlayer))
    blobName = createBlobName("player", teamOrPlayer.id, imgHash);
  else
    blobName = createBlobName(
      "team",
      teamOrPlayer.id,
      imgHash,
      teamOrPlayer.tournamentId
    );
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const uploadBlobResponse = await blockBlobClient.uploadData(fileData);
  if (teamOrPlayer.avatarHash && teamOrPlayer.avatarHash !== imgHash) {
    const blobName = isPlayer(teamOrPlayer)
      ? createBlobName("player", teamOrPlayer.id, teamOrPlayer.avatarHash)
      : createBlobName(
          "team",
          teamOrPlayer.id,
          teamOrPlayer.avatarHash,
          teamOrPlayer.tournamentId
        );
    let oldBlockBlobClient = containerClient.getBlockBlobClient(blobName);
    await oldBlockBlobClient.deleteIfExists();
  }
  if (!allBlobs.has(blobName)) allBlobs.add(blobName);

  if (isPlayer(teamOrPlayer))
    await setPlayerAvatarHash(teamOrPlayer, imgHash, performedById);
  else await setTeamAvatarHash(teamOrPlayer, imgHash, performedById);

  return uploadBlobResponse;
}

// storeAndBroadcastRecord({
//   id: uuidv4(),
//   type: recordType.playerUpdate,
//   timestamp: new Date(),
//   playerId: req.params.id,
//   userId: req.user.id,
//   v: 1,
//   valueChanged: "avatar",
//   old: undefined,
//   new: undefined,
// } as playerUpdateRecord);
// Remove Avatar

// export async function removeAvatar(
//   forWho: "player",
//   id: string
// ): Promise<BlobDeleteIfExistsResponse>;
// export async function removeAvatar(
//   forWho: "team",
//   id: string,
//   tourneyId: string
// ): Promise<BlobDeleteIfExistsResponse>;
// export async function removeAvatar(
//   forWho: "player" | "team",
//   id: string,
//   tourneyId?: string
// ): Promise<BlobDeleteIfExistsResponse> {
//   let blobName: string;
//   if (forWho === "team") blobName = createBlobName(forWho, id, tourneyId!);
//   else blobName = createBlobName(forWho, id);
//
//   if (!allBlobs.delete(blobName))
//     throw new BadRequestError("No avatar to be removed");
//
//   const blockBlobClient = containerClient.getBlockBlobClient(blobName);
//   return await blockBlobClient.deleteIfExists();
// }

// TODO: Log changing avatars

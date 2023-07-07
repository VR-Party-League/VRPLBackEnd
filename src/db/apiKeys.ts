import { VrplApiToken, ApiTokenModel } from "./models/ApiTokens";
import { v4 as uuidv4 } from "uuid";
import {
  apiTokenCreateRecord,
  apiTokenDeleteRecord,
} from "./models/records/apiTokenRecords";
import { recordType } from "./models/records";
import { storeAndBroadcastRecord } from "./records";
import { VrplUser } from "./models/vrplUser";
import crypto from "crypto";
import { VrplAuth } from "../index";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { ObjectId } from "mongoose";
import { captureException } from "@sentry/node";

export async function createApiToken(
  user: VrplUser,
  auth: VrplAuth
): Promise<VrplApiToken> {
  const token: VrplApiToken = {
    userId: user._id,
    user: user,
    apiToken: crypto.randomBytes(50).toString("hex"),
    createdAt: new Date(),
  };
  try {
    const res = await ApiTokenModel.updateOne(
      { userId: user._id },
      {
        userId: user._id,
        user: user,
        apiToken: token.apiToken,
        createdAt: new Date(),
      },
      { upsert: true }
    );
    if (res.upsertedCount !== 1 && res.modifiedCount !== 1)
      throw new InternalServerError("No changes were made to the database.");
    await storeAndBroadcastRecord({
      v: 1,
      id: uuidv4(),
      type: recordType.apiTokenCreate,
      token: token,
      performedByUserId: auth.userId,
      performedByPlayerId: auth.playerId,
      timestamp: new Date(),
    } as apiTokenCreateRecord);
    return token;
  } catch (e) {
    console.error(e);

    throw new InternalServerError(
      "Error creating api token. " + captureException(e)
    );
  }
}

export async function revokeApiToken(
  userId: ObjectId,
  auth: VrplAuth
): Promise<void> {
  const apiToken = await ApiTokenModel.findOne({ userId: userId }).exec();
  if (!apiToken) throw new BadRequestError("User has no active API tokens");
  await apiToken.remove();
  await storeAndBroadcastRecord({
    v: 1,
    id: uuidv4(),
    type: recordType.apiTokenDelete,
    token: apiToken,
    performedByUserId: auth.userId,
    performedByPlayerId: auth.playerId,
    timestamp: new Date(),
  } as apiTokenDeleteRecord);
}

export async function getUserFromApiToken(token: string) {
  const apiToken = await ApiTokenModel.findOne({ apiToken: token }).exec();
  console.log("apiToken", apiToken);
  let all = await ApiTokenModel.find({}).exec();
  console.log("all", all);
  if (!apiToken) throw new UnauthorizedError("Invalid API token");
  return apiToken.user;
}

export async function getApiTokenFromPlayerId(playerId: string) {
  return await ApiTokenModel.findOne({ playerId: playerId }).exec();
}

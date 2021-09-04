import CooldownDB, { VrplPlayerCooldown } from "./models/cooldowns";
import { v4 as uuidv4 } from "uuid";
import {
  VrplPlayerCooldownType,
  VrplPlayerCooldownTypes,
} from "../utils/cooldowns";

export async function getPlayerCooldowns(
  playerId: string,
  type?: VrplPlayerCooldownType
): Promise<VrplPlayerCooldown[]> {
  if (!type) {
    const res = await CooldownDB.find({ playerId: playerId, for: "player" });
    const toReturn: VrplPlayerCooldown[] = [];
    for (const cooldown of res) {
      if (cooldown.for === "player") {
        toReturn.push(cooldown);
      }
    }
    return toReturn;
  } else {
    const res = await CooldownDB.find({
      playerId: playerId,
      for: "player",
      type: type,
    });
    const toReturn: VrplPlayerCooldown[] = [];
    for (const cooldown of res) {
      if (cooldown.for === "player") {
        toReturn.push(cooldown);
      }
    }
    return toReturn;
  }
}

export async function doesPlayerHaveCooldown(
  playerId: string,
  type: VrplPlayerCooldownType
): Promise<boolean> {
  const res = await CooldownDB.exists({
    playerId: playerId,
    for: "player",
    type: type,
  });
  return res;
}

export async function addPlayerCooldown(
  playerId: string,
  type: VrplPlayerCooldownType,
  length?: number
): Promise<VrplPlayerCooldown> {
  const now = new Date();
  const expire = new Date(
    +now + (length || VrplPlayerCooldownTypes[type]?.duration)
  );

  const playerCooldown: VrplPlayerCooldown = {
    id: uuidv4(),
    playerId: playerId,
    for: "player",
    type: type,
    createdAt: now,
    expiresAt: expire,
  };
  const cooldown = new CooldownDB(playerCooldown);
  await cooldown.save();
  return playerCooldown;
}

export async function getCooldownFromId(
  cooldownId: string
): Promise<VrplPlayerCooldown | undefined> {
  const res = await CooldownDB.findOne({ id: cooldownId, for: "player" });
  if (res?.for !== "player") return undefined;
  return res;
}

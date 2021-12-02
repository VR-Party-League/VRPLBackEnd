import CooldownDB, {
  VrplPlayerCooldown,
  VrplTeamCooldown,
} from "./models/cooldowns";
import { v4 as uuidv4 } from "uuid";
import {
  isVrplPlayerCooldownType,
  isVrplTeamCooldownType,
  VrplPlayerCooldownType,
  VrplPlayerCooldownTypes,
  VrplTeamCooldownType,
  VrplTeamCooldownTypes,
} from "../utils/cooldowns";
import { VrplPlayer } from "./models/vrplPlayer";
import { VrplTeam } from "./models/vrplTeam";

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

export async function doesHaveCooldown(
  forWho: "player",
  forId: string,
  type: VrplPlayerCooldownType
): Promise<boolean>;
export async function doesHaveCooldown(
  forWho: "team",
  forId: string,
  type: VrplTeamCooldownType
): Promise<boolean>;
export async function doesHaveCooldown(
  forWho: "player" | "team",
  forId: string,
  type: VrplPlayerCooldownType | VrplTeamCooldownType
): Promise<boolean> {
  let res;
  if (forWho === "player") {
    if (!isVrplPlayerCooldownType(type))
      throw new Error("Cooldown type not for player");

    res = await CooldownDB.exists({
      playerId: forId,
      for: forWho,
      type: type,
    });
  } else {
    if (!isVrplTeamCooldownType(type))
      throw new Error("Cooldown type not for team");
    res = await CooldownDB.exists({
      teamId: forId,
      for: forWho,
      type: type,
    });
  }
  return res;
}

// For players:
export async function addCooldown(
  forWho: "player",
  forId: string,
  type: VrplPlayerCooldownType,
  length?: number
): Promise<VrplPlayerCooldown>;
// For teams:
export async function addCooldown(
  forWho: "team",
  forId: string,
  type: VrplTeamCooldownType,
  length?: number
): Promise<VrplTeamCooldown>;
export async function addCooldown(
  forWho: "player" | "team",
  forId: string,
  type: VrplPlayerCooldownType | VrplTeamCooldownType,
  length?: number
): Promise<VrplPlayerCooldown | VrplTeamCooldown> {
  const now = new Date();
  if (forWho === "player") {
    if (!isVrplPlayerCooldownType(type))
      throw new Error("Cooldown type not for players");
    const expire = new Date(
      +now + (length || VrplPlayerCooldownTypes[type]?.duration)
    );

    const playerCooldown: VrplPlayerCooldown = {
      id: uuidv4(),
      playerId: forId,
      for: "player",
      type: type,
      createdAt: now,
      expiresAt: expire,
    };
    const cooldown = new CooldownDB(playerCooldown);
    await cooldown.save();
    return playerCooldown;
  } else {
    if (!isVrplTeamCooldownType(type))
      throw new Error("Cooldown type not for team");
    const expire = new Date(
      +now + (length || VrplTeamCooldownTypes[type]?.duration)
    );

    const teamCooldown: VrplTeamCooldown = {
      id: uuidv4(),
      teamId: forId,
      for: "team",
      type: type,
      createdAt: now,
      expiresAt: expire,
    };
    const cooldown = new CooldownDB(teamCooldown);
    await cooldown.save();
    return teamCooldown;
  }
}

export async function getCooldownFromId<T extends "player" | "team">(
  forWho: T,
  cooldownId: string
): Promise<
  (T extends "player" ? VrplPlayerCooldown : VrplTeamCooldown) | undefined
> {
  const res = await CooldownDB.findOne({
    id: cooldownId,
    //@ts-ignore
    for: forWho,
  });
  if (!res?.for || res.for !== forWho) return undefined;
  return res;
}

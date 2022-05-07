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
import { InternalServerError } from "../utils/errors";

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

export async function getTeamCooldowns(
  teamId: string,
  tournamentId: string,
  type?: VrplTeamCooldownType
): Promise<VrplTeamCooldown[]> {
  const cooldowns: VrplTeamCooldown[] = [];
  const filter = {
    for: "team",
    teamId: teamId,
    tournamentId: tournamentId,
    type: type,
  };
  const res = await CooldownDB.find(filter).exec();
  res.forEach((cooldown) => {
    if (cooldown.for === "team") cooldowns.push(cooldown);
  });
  return cooldowns;
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

  return !!res;
}

export async function addCooldownToPlayer(
  playerId: string,
  type: VrplPlayerCooldownType,
  length?: number
): Promise<VrplPlayerCooldown> {
  const now = new Date();
  if (!isVrplPlayerCooldownType(type))
    throw new Error("Cooldown type not for players");
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

export async function addCooldownToTeam(
  teamId: string,
  tournamentId: string,
  type: VrplTeamCooldownType,
  length?: number
) {
  const now = new Date();
  if (!isVrplTeamCooldownType(type))
    throw new Error("Cooldown type not for team");
  const expire = new Date(
    +now + (length || VrplTeamCooldownTypes[type]?.duration)
  );

  const teamCooldown: VrplTeamCooldown = {
    id: uuidv4(),
    teamId: teamId,
    tournamentId: tournamentId,
    for: "team",
    type: type,
    createdAt: now,
    expiresAt: expire,
  };
  const cooldown = new CooldownDB(teamCooldown);
  await cooldown.save();
  return teamCooldown;
}

export async function getPlayerCooldownFromId(cooldownId: string) {
  const res = await CooldownDB.findOne({
    id: cooldownId,
    for: "player",
  }).exec();
  if (!res?.for) return undefined;
  else if (res.for !== "player")
    throw new InternalServerError(
      "Returned player cooldown is not a player cooldown"
    );
  return res;
}

export async function getTeamCooldownFromId(cooldownId: string) {
  const res = await CooldownDB.findOne({
    id: cooldownId,
    for: "team",
  }).exec();
  if (!res?.for) return undefined;
  else if (res.for !== "team")
    throw new InternalServerError(
      "Returned team cooldown is not a team cooldown"
    );
  return res;
}

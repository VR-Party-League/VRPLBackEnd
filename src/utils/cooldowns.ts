// Cooldown types

import ms from "ms";
export type VrplPlayerCooldownType = keyof typeof VrplPlayerCooldownTypes;
export const VrplPlayerCooldownTypes = {
  changeNickname: {
    name: "changeNickname",
    duration: ms("30d"),
    explanation:
      "There is a limit on how often people can change their nickname.",
  },
  changeAvatar: {
    name: "changeAvatar",
    duration: ms("10min"),
    explanation: "You can only change your avatar once every 10 minutes.",
  },
};
export function isVrplPlayerCooldownType(
  s: string
): s is VrplPlayerCooldownType {
  return s === "changeNickname" || s === "changeAvatar";
}

export type VrplTeamCooldownType = keyof typeof VrplTeamCooldownTypes;
export const VrplTeamCooldownTypes = {
  changeAvatar: {
    name: "changeAvatar",
    duration: ms("10min"),
    explanation: "You can only change your team avatar once every 10 minutes.",
  },
};
export function isVrplTeamCooldownType(s: string): s is VrplTeamCooldownType {
  return s === "changeAvatar";
}

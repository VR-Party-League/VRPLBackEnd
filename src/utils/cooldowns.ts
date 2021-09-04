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
};

export enum VrplTeamCooldownType {}

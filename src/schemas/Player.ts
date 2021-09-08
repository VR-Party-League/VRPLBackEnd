import { Authorized, Field, Int, ObjectType } from "type-graphql";
import { Permissions } from "../utils/permissions";
import Badge from "./Badge";
import { PlayerCooldown } from "./Cooldown";
import Team from "./Team";

@ObjectType()
export class PlayerNicknameHistoryItem {
  @Field({ description: "The nickname the player had" })
  nickname: string;
  @Field({ description: "When this nickname was replaced" })
  replacedAt: Date;
}

@ObjectType()
export default class Player {
  @Field({ description: "The player's id" })
  id: string;

  @Field({
    description: "The player's nickname, unique and changeable",
  })
  nickname: string;

  @Field((_type) => [PlayerNicknameHistoryItem], {
    description: "Previous nicknames of this player",
  })
  nicknameHistory: PlayerNicknameHistoryItem[];

  @Field({
    description:
      "The player's avatar, an url pointing to the image, or pointing to nothing!",
    nullable: true,
  })
  avatar: string;

  @Field({ description: "The player's about page" })
  about: string;

  @Field({
    description: "The region the player plays from",
    nullable: true,
  })
  region: string;

  @Authorized([
    Permissions.Admin,
    Permissions.ManagePlayers,
    Permissions.AccessDiscordId,
  ])
  @Field({
    description: "The player's discord ID, only accessible to admins and mods",
  })
  discordId: string;

  @Authorized()
  @Field({ description: "The player's discord Tag, needs authorization" })
  discordTag: string;

  @Field((_type) => [PlayerCooldown], {
    description: "The player's cooldowns, this is slow",
  })
  cooldowns: PlayerCooldown[];

  @Field((_type) => [Badge], {
    description: "The player's badges",
  })
  badges: Badge;

  @Field((_type) => Int, {
    description: "The player's permissions",
    defaultValue: 0,
  })
  permissions: number;

  @Field({
    description: "The player's permissions",
  })
  timeCreated: Date;

  @Field((_type) => [Team], { description: "The teams this player is part of" })
  teams!: Array<Team>;
}

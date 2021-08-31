import { Authorized, Field, Int, ObjectType } from "type-graphql";
import { Permissions } from "../utils/permissions";
import Badge from "./Badge";
import Team from "./Team";

@ObjectType()
export default class Player {
  @Field({ description: "The player's id" })
  id: string;

  @Field({
    description: "The player's nickname, unique and changeable",
    // TODO: add a player nickname history, with timestamps
  })
  nickname: string;

  @Field({
    description: "The player's avatar, most likely an image url",
    nullable: true,
  })
  avatar?: string;

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

  @Field((_type) => Int, {
    description:
      "The player's flags, this includes cool-downs, punishments and alike",
    defaultValue: 0,
  })
  flags: number;

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

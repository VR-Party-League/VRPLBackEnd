import { Authorized, Field, Int, ObjectType } from "type-graphql";
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
  @Field({ description: "The player's id", nullable: false })
  id: string;

  @Field({
    description: "The player's nickname, unique and changeable",
    nullable: false,
  })
  nickname: string;

  @Authorized()
  @Field({ description: "The player's email", nullable: false })
  email: string;

  @Field((_type) => [PlayerNicknameHistoryItem], {
    description: "Previous nicknames of this player",
    nullable: false,
  })
  nicknameHistory: PlayerNicknameHistoryItem[];

  @Field({
    description:
      "The player's avatar, an url pointing to the image, or pointing to nothing!",
    nullable: true,
  })
  avatar: string;

  @Field({ description: "The player's about page", nullable: false })
  about: string;

  @Field({
    description: "The region the player plays from",
    nullable: true,
  })
  region: string;

  @Authorized()
  @Field({
    description: "The player's discord ID, only accessible to admins and mods",
    nullable: false,
  })
  discordId: string;

  @Field({
    description: "The player's discord Tag",
    nullable: false,
  })
  discordTag: string;

  @Authorized()
  @Field({
    description: "The player's discord avatar hash",
    nullable: true,
  })
  discordAvatar: string;

  @Field((_type) => [PlayerCooldown], {
    description: "The player's cooldowns, this is slow",
    nullable: false,
  })
  cooldowns: PlayerCooldown[];

  @Field((_type) => [Badge], {
    description: "The player's badges",
    nullable: false,
  })
  badges: Badge;

  @Field((_type) => Int, {
    description: "The player's permissions",
    nullable: false,
  })
  permissions: number;

  @Field({
    description: "The time the player created their account",
    nullable: false,
  })
  timeCreated: Date;

  @Field((_type) => [Team], {
    description: "The teams this player is part of",
    nullable: false,
  })
  teams!: Array<Team>;
}

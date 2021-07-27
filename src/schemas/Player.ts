import { Field, Int, ObjectType } from "type-graphql";
import Team from "./Team";

@ObjectType()
export default class Player {
  @Field({ description: "The players' id", nullable: false })
  id!: string;

  @Field({ description: "The player's discord ID" })
  discordId!: string;

  @Field({ description: "The player's discord Tag" })
  discordTag!: string;

  @Field({ description: "The player's discord avatar" })
  discordAvatar: string;

  @Field((type) => Int, {
    description: "The players permissions",
    defaultValue: 0,
  })
  permissions!: number;

  @Field((type) => [Team], { description: "The teams this player is part of" })
  teams!: Array<Team>;
}

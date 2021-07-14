import { Field, Int, ObjectType } from "type-graphql";
import Player from "./Player";
type Tournament = {};
@ObjectType()
export default class Team {
  @Field({ description: "The unique team id", nullable: false })
  id!: String;

  @Field({ description: "The unique team name" })
  name!: string;

  @Field({ description: "The team captain" })
  captain!: Player;

  @Field((type) => [Player], { description: "An array of players" })
  players!: Player[];

  @Field((type) => [Player], {
    description: "Players that have not accepted the invite",
  })
  pendingPlayers!: Player[];

  //@Field((type) => [Tournament], { description: "An array of players" })
  //tournament!: Tournament[];
}

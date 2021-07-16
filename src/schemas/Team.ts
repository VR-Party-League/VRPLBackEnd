import { Field, InputType, Int, ObjectType } from "type-graphql";
import Player from "./Player";
import { TeamPlayer } from "./TeamPlayer";

@ObjectType("Team")
export default class Team {
  @Field({ description: "The unique team id", nullable: false })
  id: string;

  @Field({ description: "The unique team name" })
  name: string;

  @Field((type) => Player, {
    description: "The owner of the team, this player holds the permissions",
  })
  owner: Player;

  @Field((type) => [TeamPlayer], { description: "An array of team players" })
  teamPlayers: TeamPlayer[];

  //@Field((type) => [Tournament], { description: "An array of players" })
  //tournament!: Tournament[];
}

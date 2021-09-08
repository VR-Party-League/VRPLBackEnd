import { Field, InputType, Int, ObjectType } from "type-graphql";
import Player from "./Player";
import { TeamPlayer } from "./TeamPlayer";
import Tournament from "./Tournament";

@ObjectType("Team")
export default class Team {
  @Field({ description: "The unique team id", nullable: false })
  id: string;

  @Field({ description: "The unique team name" })
  name: string;

  @Field((_type) => Tournament, { description: "The unique team name" })
  tournament: Tournament;

  @Field((_type) => Player, {
    description: "The owner of the team, this player holds the permissions",
  })
  owner: Player;

  @Field((_type) => [TeamPlayer], { description: "An array of team players" })
  teamPlayers: TeamPlayer[];

  @Field((_type) => Date, { description: "The date this team was created" })
  createdAt: Date;
  //@Field((type) => [Tournament], { description: "An array of players" })
  //tournament!: Tournament[];
}

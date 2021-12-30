import { Field, InputType, Int, ObjectType } from "type-graphql";
import Match from "./Match";
import Player from "./Player";
import { TeamPlayer } from "./TeamPlayer";
import Tournament from "./Tournament";

@ObjectType("Team")
export default class Team {
  @Field({ description: "The unique team id", nullable: false })
  id: string;

  @Field({ description: "The unique team name" })
  name: string;
  @Field({ description: "The team avatar", nullable: true })
  avatar: string;

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

  @Field({ description: "The amount of games played" })
  gp: number;

  @Field({ description: "The amount of games won" })
  wins: number;

  @Field({
    description: "The amount of games [insert a form of 'losing' here]",
  })
  losses: number;

  @Field({ description: "The amount of games tied" })
  ties: number;

  @Field((_type) => [Match], {
    description:
      "The matches of the team that should be displayed on their profile",
  })
  matches: Match[];
  //@Field((type) => [Tournament], { description: "An array of players" })
  //tournament!: Tournament[];
}
// TODO: fix team return undefined on first load

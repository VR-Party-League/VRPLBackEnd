import { Field, Int, ObjectType } from "type-graphql";
import Match from "./Match";
import Player from "./Player";
import { TeamPlayer } from "./TeamPlayer";
import Tournament from "./Tournament";
import { VrplTeam } from "../db/models/vrplTeam";
import { PlayerCooldown, TeamCooldown } from "./Cooldown";

@ObjectType("Team")
export default class Team {
  @Field({ description: "The unique team id", nullable: false })
  id: string;

  @Field({ description: "The team seed", nullable: true })
  seed: number;

  @Field({ description: "The unique team name" })
  name: string;

  @Field({ description: "The team avatar", nullable: true })
  avatar: string;

  @Field((_type) => Tournament, { description: "The unique team name" })
  tournament: Tournament;

  @Field({ description: "The tournament id" })
  tournamentId: string;

  @Field((_type) => [TeamCooldown], {
    description: "The team's cooldowns",
    nullable: false,
  })
  cooldowns: TeamCooldown[];

  @Field((_type) => Player, {
    description: "The owner of the team, this player holds the permissions",
  })
  owner: Player;

  @Field({ description: "The id of the team owner" })
  ownerId: string;

  @Field((_type) => [TeamPlayer], { description: "An array of team players" })
  teamPlayers: TeamPlayer[];

  @Field((_type) => Date, { description: "The date this team was created" })
  createdAt: Date;

  @Field((_type) => Int, { description: "The amount of games played" })
  gp: number;

  @Field((_type) => Int, { description: "The amount of games won" })
  wins: number;

  @Field((_type) => Int, {
    description: "The amount of games [insert a form of 'losing' here]",
  })
  losses: number;

  @Field((_type) => Int, { description: "The amount of games tied" })
  ties: number;

  @Field((_type) => [Match], {
    description:
      "The matches of the team that should be displayed on their profile",
  })
  matches: Match[];

  @Field((_type) => Socials, { description: "An array of team socials" })
  socials: VrplTeam["socials"];
}

@ObjectType("Socials")
export class Socials {
  @Field({ nullable: true })
  discord?: string;

  @Field({ nullable: true })
  twitter?: string;

  @Field({ nullable: true })
  youtube?: string;

  // @Field({ nullable: true })
  // instagram?: string;

  @Field({ nullable: true })
  twitch?: string;

  // @Field({ nullable: true })
  // facebook?: string;
}

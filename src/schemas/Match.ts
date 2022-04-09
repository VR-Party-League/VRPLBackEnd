import { Field, InputType, Int, ObjectType } from "type-graphql";
import Team from "./Team";
import Tournament from "./Tournament";

@ObjectType()
export default class Match {
  // Basic match information
  @Field({ description: "The unique match id", nullable: false })
  id: string;

  @Field({ description: "The tournament" })
  tournament: Tournament;

  @Field((_type) => [Int], {
    description: "The seeds of the teams that will be playing in this match",
  })
  seeds: number[];

  @Field((_type) => [Team], { description: "The teams playing the match" })
  teams: [Team];

  @Field({ description: "The time people can start submitting" })
  timeStart: Date;

  @Field({ description: "The submission deadline" })
  timeDeadline: Date;

  // Submitted match information
  @Field((_type) => [Int], {
    description: "The seeds of the teams that have confirmed the scores",
    nullable: true,
  })
  seedsConfirmed: number[];

  @Field((_type) => [Team], {
    description: "The teams that have confirmed the scores",
    nullable: true,
  })
  teamsConfirmed: [Team];

  @Field((_type) => [[Int]], {
    description: "The submitted scores",
    nullable: true,
  })
  scores: [[Number]];

  @Field({ description: "The time the score was submitted", nullable: true })
  timeSubmitted: Date;

  @Field((_type) => Team, {
    description: "The team who submitted the match",
    nullable: true,
  })
  submitter: Team;

  @Field((_type) => Int, {
    description: "The seed of the team who submitted the match",
    nullable: true,
  })
  submitterSeed: number;

  @Field({
    description: "If set to true the match is a forfeit",
    nullable: true,
  })
  isForfeit: Boolean;

  // Completed match information
  @Field({
    description: "The time the score was fully confirmed",
    nullable: true,
  })
  timeConfirmed: Date;

  @Field((_type) => Match, {
    description: "The winner of the match",
    nullable: true,
  })
  winner: Team;

  @Field((_type) => [Team], {
    description: "The teams that tied ",
    nullable: true,
  })
  tied: [Team];

  @Field((_type) => [Team], {
    description: "The teams that lost",
    nullable: true,
  })
  losers: [Team];
}

@InputType()
export class MatchScoreInput {
  @Field((_type) => [[Number]])
  rounds: number[][];
}

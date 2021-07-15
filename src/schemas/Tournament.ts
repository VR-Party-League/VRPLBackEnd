import { Field, InputType, Int, ObjectType } from "type-graphql";
import Match from "./Match";
import Player from "./Player";
import { Rule } from "./Rule";
import Team from "./Team";

@ObjectType()
export default class Tournament {
  @Field({ description: "The unique tournament id", nullable: false })
  id: string;

  @Field({ description: "The tournament type", nullable: false })
  type: string;

  @Field({ description: "The unique tournament name", nullable: false })
  name: string;

  @Field({ description: "The tournament description" })
  description: string;

  @Field({ description: "The tournament banner" })
  banner: string;

  @Field({ description: "The tournament gameId" })
  gameId: string;

  @Field((type) => [Rule], { description: "The tournament rules" })
  rules: Rule[];

  @Field({ description: "The amount of rounds in the tournament" })
  rounds: string;

  @Field((type) => [Team], {
    description: "Teams in the tournament",
  })
  teams: Team[];

  @Field((type) => [Match], {
    description: "All the matches that the tournament had",
  })
  matches: Match[];

  @Field((type) => [Match], { description: "The currently active matches" })
  currentMatches: Match[];

  @Field({ description: "The start date" })
  start: Date;
  @Field({ description: "The end date" })
  end: Date;
  @Field({ description: "The registration start date" })
  registrationStart: Date;
  @Field({ description: "The registration end date" })
  registrationEnd: Date;

  @Field({
    description: "The eligibility check that has to be run",
    nullable: true,
  })
  eligibilityCheck: string;
  @Field({ description: "The allowed region", nullable: true })
  region: string;
}

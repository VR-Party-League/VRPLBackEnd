import { Field, ObjectType } from "type-graphql";
import Game from "./Game";
import Match from "./Match";
import Team from "./Team";

@ObjectType()
export default class Tournament {
  @Field({ description: "The unique tournament id", nullable: false })
  id: string;

  @Field({ description: "The tournament type", nullable: false })
  type: string;

  @Field({ description: "The unique tournament slug", nullable: false })
  slug: string;

  @Field({ description: "The tournament name", nullable: false })
  name: string;

  @Field({ description: "The tournament description" })
  description: string;

  @Field({ description: "The tournament summary" })
  summary: string;

  @Field({ description: "The tournament banner, as a link to a png" })
  banner: string;

  @Field({ description: "The tournament icon, as a link to an svg" })
  icon: string;

  @Field({ description: "The tournament game" })
  game: Game;

  @Field({ description: "The tournament rules, as markdown text" })
  rules: string;

  @Field({ description: "The amount of rounds a match has in this tournament" })
  matchRounds: number;

  @Field({
    description: "The maximum score allowed to enter by players for a match",
    nullable: true,
  })
  matchMaxScore: number;

  @Field((type) => [Team], {
    description: "Teams in the tournament",
  })
  teams: Team[];

  @Field((_type) => [Match], {
    description: "All the matches that the tournament had",
  })
  matches: Match[];

  @Field((_type) => [Match], { description: "The currently active matches" })
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

import { Field, InputType, Int, ObjectType } from "type-graphql";
import Player from "./Player";
import Team from "./Team";
import Tournament from "./Tournament";

@ObjectType()
export default class Match {
  @Field({ description: "The unique match id", nullable: false })
  id: string;

  @Field({ description: "The tournament" })
  tournament: Tournament;

  @Field((_type) => [Team], { description: "The teams playing the match" })
  teams: [Team];

  @Field((_type) => [[Int]], {
    description: "The submitted scores",
    nullable: true,
  })
  scores: [[Number]];

  @Field((_type) => [Team], {
    description: "The teams that have confirmed the scores",
    defaultValue: [],
  })
  teamsConfirmed: [Team];

  @Field({ description: "The time people can start submitting" })
  timeStart: Date;

  @Field({ description: "The submission deadline" })
  timeDeadline: Date;

  @Field({ description: "The time the score was submitted", nullable: false })
  timeSubmitted: Date;

  @Field({
    description: "The time the score was fully confirmed",
    nullable: false,
  })
  timeConfirmed: Date;
}

@InputType()
export class MatchScoreInput {
  @Field((_type) => [[Number]])
  rounds: number[][];
}

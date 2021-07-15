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

  @Field((type) => [Team], { description: "The teams playing the match" })
  teams: [Team];

  @Field((type) => [[Int]], {
    description: "The submitted scores",
    nullable: true,
  })
  scores: [[Number]];

  @Field((type) => [Team], {
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

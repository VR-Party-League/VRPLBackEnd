import { Field, ObjectType } from "type-graphql";
import Tournament from "./Tournament";

@ObjectType()
export default class Game {
  @Field({ description: "The game id", nullable: false })
  id!: string;

  @Field({ description: "The name of the game" })
  name!: string;

  @Field({ description: "The banner of the game" })
  banner!: string;

  @Field({ description: "The description of the game" })
  description!: string;

  @Field((_type) => [GameField], { description: "The game fields" })
  fields: GameField[];

  @Field((_type) => [Tournament], {
    description: "The tournaments of this game",
  })
  tournaments: Array<Tournament>;

  @Field({ description: "Games Played" })
  gp: number;
  @Field({ description: "Games Won" })
  wins: number;
  @Field({ description: "Games Lost" })
  losses: number;
  @Field({ description: "Games Tied" })
  ties: number;
}

@ObjectType()
export class GameField {
  @Field({ description: "The field title", nullable: false })
  title!: string;
  @Field({ description: "The field value", nullable: false })
  value!: string;
}

// TODO: team stats
/**
 * i was thinking of the following:
 *  .matches played
 *  .matches won
 *  .matches lost
 *  .matches tied
 *  .points scored
 */

import { Field, ObjectType } from "type-graphql";
import Player from "./Player";

@ObjectType()
export class TeamPlayer {
  @Field()
  player: Player;
  @Field()
  roleId: number;
  @Field()
  roleName: string;
}

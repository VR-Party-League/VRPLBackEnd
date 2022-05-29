import { Authorized, Field, FieldResolver, ObjectType } from "type-graphql";
import { Permissions } from "../utils/permissions";
import { VrplUser } from "../db/models/vrplUser";
import Player from "./Player";

@ObjectType()
export default class ApiToken {
  @Field({
    description:
      "The api token, which can be used by setting the Authorization header to 'Token [apiToken]'",
    nullable: false,
  })
  apiToken: string;

  @Field({
    description: "When the api token got created",
    nullable: false,
  })
  createdAt: Date;

  @Field({
    description: "The player id",
    nullable: true,
  })
  playerId: string;

  @Field((_type) => Player, {
    description: "The player",
    nullable: true,
  })
  player: VrplUser;

  @Authorized([Permissions.Admin])
  @Field({
    description: "The user id",
  })
  userId: string;
}

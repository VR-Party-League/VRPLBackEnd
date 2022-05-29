import { Authorized, Field, ObjectType } from "type-graphql";
import { Permissions } from "../utils/permissions";
import Player from "./Player";

@ObjectType()
export class OAuth2Client {
  @Field()
  id: string;
  @Field()
  clientId: string;
  @Authorized([Permissions.Admin])
  @Field()
  clientSecret: string;
  @Field()
  clientName: string;
  @Field((_type) => [String])
  redirectUris: string[];
  @Field((_type) => [String])
  grants: string[];
  @Field()
  accessTokenLifetime: number;
  @Field()
  refreshTokenLifetime: number;
  @Field()
  createdAt: Date;
  @Authorized([Permissions.Admin])
  @Field()
  userId: string;
  @Field()
  playerId: string;
  @Field()
  player: Player;
}

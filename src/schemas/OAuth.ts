import { Field, ObjectType, UseMiddleware } from "type-graphql";
import { Authenticate, Permissions } from "../utils/permissions";
import Player from "./Player";

@ObjectType()
export class OAuth2Client {
  @Field()
  id: string;
  @Field()
  clientId: string;
  @UseMiddleware(Authenticate(["oauth2.client.clientSecret:read"]))
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
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.Admin]))
  @Field()
  userId: string;
  @Field()
  playerId: string;
  @Field()
  player: Player;
}

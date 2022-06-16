import {
  Arg,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { OAuth2Client } from "../schemas/OAuth";
import Player from "../schemas/Player";
import { OAuthClient } from "../db/models/OAuthModels";
import { getPlayerFromId, getPlayerFromUserId } from "../db/player";
import {
  createOAuth2Client,
  getOauthClientFromClientId,
  getOauthClientsOfUser,
} from "../db/OAuth";
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from "../utils/errors";
import { Context } from "../index";
import { Authenticate, Permissions } from "../utils/permissions";
import { getUserFromPlayerId } from "../db/user";

@Resolver((_of) => OAuth2Client)
export class OAuth2ClientResolver {
  @FieldResolver((_type) => Player)
  async player(@Root() oauthClient: OAuthClient) {
    return getPlayerFromUserId(oauthClient.userId);
  }

  @Query((_returns) => OAuth2Client)
  async getOAuth2ClientFromClientId(@Arg("clientId") clientId: string) {
    return getOauthClientFromClientId(clientId);
  }

  @Query((_returns) => [OAuth2Client])
  async getOauth2ClientsOfPlayer(@Arg("playerId") playerId: string) {
    const user = await getUserFromPlayerId(playerId);
    if (!user)
      throw new InternalServerError("No user found linked to that player");
    return getOauthClientsOfUser(user._id);
  }

  @Mutation((_returns) => OAuth2Client)
  @UseMiddleware(Authenticate(["oauth2.client:write"]))
  async createOAuth2Client(
    @Arg("clientName") clientName: string,
    @Arg("redirectUris", (_type) => [String]) redirectUris: string[],
    @Arg("grants", (_type) => [String]) grants: string[],
    @Arg("playerId") playerId: string,
    @Ctx() { auth }: Context
  ) {
    if (!auth) throw new UnauthorizedError();
    const player = await getPlayerFromId(playerId);
    if (!player) throw new BadRequestError("Player not found");
    if (player.id !== auth.playerId) auth?.assurePerm(Permissions.Admin);
    const user = await getUserFromPlayerId(playerId);
    if (!user)
      throw new InternalServerError("No user found linked to that player!");
    return createOAuth2Client(clientName, redirectUris, grants, user._id, auth);
  }

  // @Mutation((_returns) => OAuth2Client)
  // async deleteOAuth2Client(
  //   @Arg("clientId") clientId: string,
  //   @Ctx() ctx: Context
  // ) {
  //   const user = ctx.user!;
  //   const oauthClient = await getOauthClientFromClientId(clientId);
  //   if (!oauthClient) throw new BadRequestError("OAuth2 client not found");
  //   if (oauthClient.userId !== user.id && !userHasPermission(user, Permissions.Admin))
  //     throw new ForbiddenError(
  //       "You are not allowed to delete OAuth2 clients for other players"
  //     );
  //
  //   return oauthClient;
  // }
}

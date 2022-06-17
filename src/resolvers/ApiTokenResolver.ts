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
import ApiToken from "../schemas/ApiToken";
import { Authenticate, Permissions, ResolvePlayer } from "../utils/permissions";
import { Context } from "../index";
import {
  createApiToken,
  getApiTokenFromPlayerId,
  revokeApiToken,
} from "../db/apiKeys";
import { VrplApiToken } from "../db/models/ApiTokens";
import { getUserFromPlayerId } from "../db/user";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { VrplPlayer } from "../db/models/vrplPlayer";
import Player from "../schemas/Player";
import { getPlayerFromId } from "../db/player";

@Resolver((_of) => ApiToken)
export default class ApiTokenResolver {
  @Query((_returns) => ApiToken, { nullable: true })
  @UseMiddleware(
    ResolvePlayer("playerId", true, { override: Permissions.Admin })
  )
  @UseMiddleware(Authenticate(["oauth2.apiToken:read"]))
  async getApiTokenOfPlayer(
    @Arg("playerId") playerId: string,
    @Ctx() { resolved }: Context
  ): Promise<VrplApiToken | null> {
    const player = resolved.player!;
    return await getApiTokenFromPlayerId(player.id!);
  }

  @Mutation((_returns) => ApiToken)
  @UseMiddleware(
    ResolvePlayer("playerId", true, { override: Permissions.Admin })
  )
  @UseMiddleware(Authenticate(["oauth2.apiToken:write"]))
  async createApiToken(
    @Arg("playerId") playerId: string,
    @Ctx() { resolved, auth }: Context
  ): Promise<VrplApiToken> {
    const player = resolved.player!;
    const user = await getUserFromPlayerId(player.id);
    if (!user)
      throw new InternalServerError(
        "The player does not have a user associated with it."
      );
    return await createApiToken(user, auth!);
  }

  @Mutation((_returns) => ApiToken)
  @UseMiddleware(
    ResolvePlayer("playerId", true, { override: Permissions.Admin })
  )
  @UseMiddleware(Authenticate(["oauth2.apiToken:write"]))
  async revokeApiToken(
    @Arg("playerId") playerId: string,
    @Ctx() { resolved, auth }: Context
  ): Promise<VrplApiToken> {
    const player = resolved.player!;
    const user = await getUserFromPlayerId(player.id);
    if (!user)
      throw new BadRequestError(
        "The player does not have a user associated with it."
      );
    const token = await getApiTokenFromPlayerId(player.id);
    if (!token)
      throw new BadRequestError(
        "The player does not have an API token active API token."
      );
    await revokeApiToken(user._id, auth!);
    return token;
  }

  @FieldResolver((_returns) => Player, { nullable: true })
  async player(@Root() apiToken: VrplApiToken): Promise<VrplPlayer | null> {
    if (!apiToken.user?.playerId) return null;
    return await getPlayerFromId(apiToken.user.playerId);
  }

  @FieldResolver((_returns) => String, { nullable: true })
  playerId(@Root() apiToken: VrplApiToken): string | undefined {
    return apiToken.user?.playerId;
  }
}

import {
  Arg,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { getGameById, getGameFromName, getGamesArray } from "../db/game";
import { VrplGame } from "../db/models/vrplGame";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTournamentsOfGame } from "../db/tournaments";
import Game from "../schemas/Game";
import { Authenticate, Permissions } from "../utils/permissions";
import { BadRequestError } from "../utils/errors";
import { revalidateGamePage } from "../db/records";

@Resolver((_of) => Game)
export default class GameResolver {
  @Query((_returns) => Game, { nullable: true })
  gameFromId(@Arg("gameId") gameId: string): Promise<VrplGame | null> {
    return getGameById(gameId);
  }

  @Query((_returns) => Game, { nullable: true })
  gameFromName(@Arg("gameName") gameName: string): Promise<VrplGame | null> {
    return getGameFromName(gameName);
  }

  @Query((_returns) => [Game])
  allGames(): Promise<VrplGame[]> {
    return getGamesArray();
  }

  @FieldResolver()
  tournaments(@Root() vrplGame: VrplGame): Promise<VrplTournament[]> {
    return getTournamentsOfGame(vrplGame.id);
  }

  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.Admin]))
  @Mutation((_returns) => Game)
  async revalidateGamePage(@Arg("gameId") gameId: string) {
    const game = await getGameById(gameId);
    if (!game) throw new BadRequestError("Game not found");
    await revalidateGamePage(game.name);
    return game;
  }
}

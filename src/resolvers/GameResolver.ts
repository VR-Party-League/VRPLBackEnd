import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { getGameById, getGamesArray } from "../db/game";
import { VrplGame } from "../db/models/vrplGame";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getTournamentsOfGame } from "../db/tournaments";
import Game from "../schemas/Game";

@Resolver((_of) => Game)
export default class GameResolver {
  @Query((_returns) => Game, { nullable: true })
  gameFromId(@Arg("gameId") gameId: string): Promise<VrplGame | null> {
    return getGameById(gameId);
  }

  @Query((_returns) => [Game])
  allGames(): Promise<VrplGame[]> {
    return getGamesArray();
  }

  @FieldResolver()
  tournaments(@Root() vrplGame: VrplGame): Promise<VrplTournament[]> {
    return getTournamentsOfGame(vrplGame.id);
  }
}

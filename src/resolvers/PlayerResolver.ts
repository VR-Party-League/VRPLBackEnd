import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import { getPlayerFromDiscordId, getPlayerFromId } from "../db/player";
import { getAllTeamsOfPlayer } from "../db/team";
import Player from "../schemas/Player";

@Resolver((of) => Player)
export default class {
  @Query((returns) => Player, { nullable: true })
  playerFromId(@Arg("playerId") playerId: string): Promise<VrplPlayer | null> {
    return getPlayerFromId(playerId);
  }
  @Query((returns) => Player, { nullable: true })
  playerFromDiscordId(
    @Arg("discordId") discordId: string
  ): Promise<VrplPlayer | null> {
    return getPlayerFromDiscordId(discordId);
  }

  @FieldResolver()
  teams(@Root() vrplPlayer: VrplPlayer): Promise<VrplTeam[]> {
    return getAllTeamsOfPlayer(vrplPlayer.id);
  }
}

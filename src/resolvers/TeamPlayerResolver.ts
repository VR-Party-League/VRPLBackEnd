import { FieldResolver, Resolver, Root } from "type-graphql";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeamPlayer, VrplTeamPlayerRole } from "../db/models/vrplTeam";
import { getPlayerFromId } from "../db/player";
import { TeamPlayer } from "../schemas/TeamPlayer";

@Resolver((of) => TeamPlayer)
export default class {
  @FieldResolver()
  async player(@Root() vrplTeamPlayer: VrplTeamPlayer): Promise<VrplPlayer> {
    return (await getPlayerFromId(vrplTeamPlayer.playerId))!;
  }
  @FieldResolver()
  roleId(@Root() vrplTeamPlayer: VrplTeamPlayer): number {
    return vrplTeamPlayer.role;
  }
  @FieldResolver()
  roleName(@Root() vrplTeamPlayer: VrplTeamPlayer): string {
    return VrplTeamPlayerRole[vrplTeamPlayer.role]!;
  }
}

import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { getPlayerCooldownFromId, getTeamCooldownFromId } from "../db/cooldown";
import { VrplPlayerCooldown, VrplTeamCooldown } from "../db/models/cooldowns";
import { PlayerCooldown, TeamCooldown } from "../schemas/Cooldown";
import {
  VrplPlayerCooldownTypes,
  VrplTeamCooldownTypes,
} from "../utils/cooldowns";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { getPlayerFromId } from "../db/player";
import { getTeamFromId } from "../db/team";
import { VrplTeam } from "../db/models/vrplTeam";
import Player from "../schemas/Player";
import Team from "../schemas/Team";

@Resolver((_of) => PlayerCooldown)
export class PlayerCooldownResolver {
  @Query((_returns) => PlayerCooldown, { nullable: true })
  playerCooldownFromId(
    @Arg("cooldownId") cooldownId: string
  ): Promise<VrplPlayerCooldown | undefined> {
    return getPlayerCooldownFromId(cooldownId);
  }

  @FieldResolver((_returns) => Team)
  explanation(@Root() playerCooldown: VrplPlayerCooldown): string | undefined {
    return VrplPlayerCooldownTypes[playerCooldown.type]?.explanation;
  }

  @FieldResolver()
  async player(
    @Root() playerCooldown: VrplPlayerCooldown
  ): Promise<VrplPlayer> {
    return (await getPlayerFromId(playerCooldown.playerId))!;
  }
}

@Resolver((_of) => TeamCooldown)
export class TeamCooldownResolver {
  @Query((_returns) => TeamCooldown, { nullable: true })
  teamCooldownFromId(
    @Arg("cooldownId") cooldownId: string
  ): Promise<VrplTeamCooldown | undefined> {
    return getTeamCooldownFromId(cooldownId);
  }

  @FieldResolver()
  explanation(@Root() playerCooldown: VrplTeamCooldown): string | undefined {
    return VrplTeamCooldownTypes[playerCooldown.type]?.explanation;
  }

  @FieldResolver((_returns) => Player)
  async player(@Root() teamCooldown: VrplTeamCooldown): Promise<VrplTeam> {
    return (await getTeamFromId(
      teamCooldown.tournamentId,
      teamCooldown.teamId
    ))!;
  }
}

import { Arg, FieldResolver, Query, Resolver, Root } from "type-graphql";
import { getCooldownFromId } from "../db/cooldown";
import { VrplPlayerCooldown } from "../db/models/cooldowns";
import { PlayerCooldown } from "../schemas/Cooldown";
import { VrplPlayerCooldownTypes } from "../utils/cooldowns";

@Resolver((_of) => PlayerCooldown)
export class PlayerCooldownResolver {
  @Query((_returns) => PlayerCooldown, { nullable: true })
  playerCooldownFromId(
    @Arg("cooldownId") cooldownId: string
  ): Promise<VrplPlayerCooldown | undefined> {
    return getCooldownFromId("player", cooldownId);
  }

  @FieldResolver()
  explanation(@Root() playerCooldown: VrplPlayerCooldown): string | undefined {
    return VrplPlayerCooldownTypes[playerCooldown.type]?.explanation;
  }
}

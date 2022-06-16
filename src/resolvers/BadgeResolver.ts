import {
  Arg,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from "type-graphql";
import { Context } from "..";
import {
  createNewBadge,
  getAllBadges,
  getBadgeFromBitPosition,
  getBadgeFromName,
  getBadgesFromBitField,
  getFreeBadgePosition,
  refreshBadgesCache,
} from "../db/badge";
import { VrplBadge } from "../db/models/vrplBadge";
import Badge from "../schemas/Badge";
import { BadRequestError } from "../utils/errors";
import { Authenticate, Permissions } from "../utils/permissions";

@Resolver((_of) => Badge)
export default class BadgeResolver {
  @Query((_returns) => [Badge])
  badgesFromBitField(
    @Arg("bitField", (_type) => Int) bitField: number
  ): Promise<VrplBadge[]> {
    return getBadgesFromBitField(bitField);
  }

  @Query((_returns) => Badge, { nullable: true })
  badgeFromName(
    @Arg("name", { nullable: true }) name: string
  ): Promise<VrplBadge | undefined> {
    return getBadgeFromName(name);
  }

  @Query((_returns) => Badge, { nullable: true })
  badgeFromBitPosition(
    @Arg("bitPosition", (_type) => Int) bitPosition: number
  ): Promise<VrplBadge | undefined> {
    return getBadgeFromBitPosition(bitPosition);
  }

  @Query((_returns) => [Badge])
  allBadges(): Promise<VrplBadge[]> {
    return getAllBadges();
  }

  @FieldResolver()
  bit(@Root() badge: VrplBadge): number {
    return 1 << badge.bitPosition;
  }

  @Mutation((_returns) => Badge)
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageBadges]))
  async createBadge(
    @Ctx() { auth }: Context,
    @Arg("name") name: string,
    @Arg("description") description: string,
    @Arg("icon") icon: string,
    @Arg("bitPosition", (_type) => Int, { nullable: true })
    bitPosition?: number
  ): Promise<VrplBadge> {
    if (!auth) throw new Error("Not authorized!?!?");
    const badge: VrplBadge = {
      name,
      description,
      icon,
      bitPosition: bitPosition ?? (await getFreeBadgePosition()),
      createdAt: new Date(),
    };
    if (await getBadgeFromBitPosition(badge.bitPosition))
      throw new BadRequestError(
        "Invalid bitPosition, a badge with that bitPosition already exists"
      );
    else if (await getBadgeFromName(badge.name))
      throw new BadRequestError(
        "Invalid badge name, a badge with that name already exists"
      );
    const res = await createNewBadge(badge, auth);
    return res;
  }

  @Mutation((_returns) => [Badge])
  @UseMiddleware(Authenticate(["USE_PERMISSIONS"], [Permissions.ManageBadges]))
  async refreshBadgeCache(): Promise<VrplBadge[]> {
    return refreshBadgesCache();
  }
}

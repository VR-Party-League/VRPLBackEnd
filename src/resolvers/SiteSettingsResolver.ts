import {
  Arg,
  Authorized,
  Ctx,
  FieldResolver,
  Int,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { Context } from "..";
import {} from "../db/badge";
import { VrplSiteSetting } from "../db/models/vrplSiteSettings";
import {
  getSiteSettingFromKey,
  updateSiteSettingValue,
} from "../db/siteSettings";
import SiteSettings from "../schemas/SiteSettings";
import { findPositions } from "../utils/bitFields";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "../utils/errors";
import { Permissions, userHasPermission } from "../utils/permissions";

@Resolver((_of) => SiteSettings)
export default class SiteSettingsResolver {
  @Query((_returns) => SiteSettings, { nullable: true })
  async getSettingFromKey(
    @Arg("key", (_type) => String) key: string,
    @Ctx() ctx: Context
  ): Promise<VrplSiteSetting> {
    const setting = await getSiteSettingFromKey(key);
    if (!setting) throw new ForbiddenError();
    if (!setting.viewPerms || setting.viewPerms === 0) return setting;
    const perms = setting.viewPerms;
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const permsArray = findPositions(perms);
    if (!permsArray.some((perm) => userHasPermission(user, 1 << perm)))
      throw new ForbiddenError();
    return setting;
  }

  // TODO: Make sure these perms really work
  @Authorized()
  @Mutation((_returns) => SiteSettings)
  async updateSettingValue(
    @Arg("key", (_type) => String) key: string,
    @Arg("value", (_type) => String) value: string,
    @Ctx() ctx: Context
  ): Promise<VrplSiteSetting> {
    const user = ctx.user;
    if (!user) throw new UnauthorizedError();
    const setting = await getSiteSettingFromKey(key);
    if (!setting) throw new ForbiddenError();
    if (
      (!setting.editPerms || setting.editPerms === 0) &&
      !userHasPermission(user, Permissions.Admin)
    )
      throw new ForbiddenError();
    const perms = setting.editPerms || 0;
    const permsArray = findPositions(perms);
    if (permsArray.some((perm) => !userHasPermission(user, perm)))
      throw new ForbiddenError();

    try {
      const newSetting = await updateSiteSettingValue(key, value);
      return newSetting;
    } catch (e) {
      throw new BadRequestError(`${e}`);
    }
  }

  // async createBadge(
  //   @Ctx() ctx: Context,
  //   @Arg("name") name: string,
  //   @Arg("description") description: string,
  //   @Arg("icon") icon: string,
  //   @Arg("bitPosition", (_type) => Int, { nullable: true })
  //   bitPosition?: number
  // ): Promise<VrplBadge> {
  //   const user = ctx.user;
  //   if (!user) throw new Error("Not authorized!?!?");
  //   const badge: VrplBadge = {
  //     name,
  //     description,
  //     icon,
  //     bitPosition: bitPosition ?? (await getFreeBadgePosition()),
  //     createdAt: new Date(),
  //   };
  //   if (await getBadgeFromBitPosition(badge.bitPosition))
  //     throw new BadRequestError(
  //       "Invalid bitPosition, a badge with that bitPosition already exists"
  //     );
  //   else if (await getBadgeFromName(badge.name))
  //     throw new BadRequestError(
  //       "Invalid badge name, a badge with that name already exists"
  //     );
  //   const res = await createNewBadge(badge, user.id);
  //   return res;
  // }
}

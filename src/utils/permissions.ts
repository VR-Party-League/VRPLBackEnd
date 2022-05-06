import {AuthChecker} from "type-graphql";
import {Context} from "..";
import {VrplPlayer} from "../db/models/vrplPlayer";

export enum Permissions {
  None = 0,                   // 0
  Admin = 1 << 0,             // 1
  Server = 1 << 1,            // 2
  ManageTournaments = 1 << 2, // 4
  ManageMatches = 1 << 3,     // 8
  ManagePlayers = 1 << 4,     // 16
  ManageBadges = 1 << 5,      // 32
  ManageTeams = 1 << 6,       // 64
  ManageMessages = 1 << 7,    // 128
  AccessDiscordId = 1 << 10,  // 256
  
  //All = ~(~0 << 2), // 0111
}

function bitFieldHas(bitField: number, permission: Permissions): boolean {
  if ((bitField & permission) === permission) return true;
  return false;
}

export const userHasPermission = (
  user: VrplPlayer,
  permission: Permissions
): boolean => {
  if (bitFieldHas(user.permissions, Permissions.Admin)) return true;
  else if (bitFieldHas(user.permissions, permission)) return true;
  return false;
};

export const userHasOneOfPermissions = (
  user: VrplPlayer,
  permissions: Permissions[]
): boolean => {
  if (bitFieldHas(user.permissions, Permissions.Admin)) return true;
  for (const permission of permissions) {
    if (bitFieldHas(user.permissions, permission)) return true;
  }
  return false;
};
export const authChecker: AuthChecker<any, any> = (
  opts: { context: Context },
  roles
) => {
  if (!opts.context.user?.id) return false;
  
  const userPerms = opts.context.user.permissions;
  if (bitFieldHas(userPerms, Permissions.Admin)) return true;
  else if (!roles?.[0]) return true;
  else if (userPerms === Permissions.None) return false;
  
  for (const role of roles) {
    if (typeof role !== "number")
      throw new Error(
        "The permission role type isn't a number. Try doing 'Permissions.Admin'"
      );
    else if (bitFieldHas(userPerms, role)) return true;
  }
  
  return false;
};

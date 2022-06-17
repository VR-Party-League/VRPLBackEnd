import { AuthChecker, MiddlewareFn } from "type-graphql";
import { Context } from "..";
import { AllOAuthScopes } from "../db/models/OAuthModels";
import { getPlayerFromId } from "../db/player";
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  PlayerNotFoundError,
  TeamNotFoundError,
  UnauthorizedError,
} from "./errors";
import { getTeamFromId } from "../db/team";

export enum Permissions {
  None = 0, // 0
  Admin = 1 << 0, // 1
  Server = 1 << 1, // 2
  ManageTournaments = 1 << 2, // 4
  ManageMatches = 1 << 3, // 8
  ManagePlayers = 1 << 4, // 16
  ManageBadges = 1 << 5, // 32
  ManageTeams = 1 << 6, // 64
  ManageMessages = 1 << 7, // 128
  AccessDiscordId = 1 << 10, // 256

  //All = ~(~0 << 2), // 0111
}

function bitFieldHas(bitField: number, permission: Permissions): boolean {
  if ((bitField & permission) === permission) return true;
  return false;
}

export const userHasPermission = (
  user: { permissions: number },
  permission: Permissions
): boolean => {
  if (bitFieldHas(user.permissions, Permissions.Admin)) return true;
  else if (bitFieldHas(user.permissions, permission)) return true;
  return false;
};

export const userHasOneOfPermissions = (
  user: { permissions: number },
  permissions: Permissions[]
): boolean => {
  if (bitFieldHas(user.permissions, Permissions.Admin)) return true;
  for (const permission of permissions) {
    if (bitFieldHas(user.permissions, permission)) return true;
  }
  return false;
};
export const authChecker: AuthChecker<Context> = (
  opts: { context: Context },
  roles
) => {
  if (!opts.context.auth) return false;
  const userPerms = opts.context.auth.permissions;
  if (bitFieldHas(userPerms, Permissions.Admin)) return true;
  else if (!roles?.[0]) return true;
  else if (userPerms === Permissions.None) return false;

  for (const role of roles) {
    if (typeof role !== "number")
      throw new InternalServerError(
        "The permission role type isn't a number. Try doing 'Permissions.Admin'"
      );
    else if (bitFieldHas(userPerms, role)) return true;
  }
  return false;
};

export function Authenticate(
  requiredScope: AllOAuthScopes[],
  requiredPermissions?: Permissions[]
): MiddlewareFn<Context> {
  return async ({ context }, next) => {
    const auth = context.auth;
    const scope = auth?.scope || [];
    if (!auth) throw new UnauthorizedError();
    else if (requiredPermissions) {
      if (requiredPermissions.some((p) => !auth?.hasPerm(p)))
        throw new ForbiddenError(
          `Insufficient permissions. Required are: ${requiredPermissions
            .map((p) => Permissions[p])
            .join(", ")}`
        );
      auth.assureScope("USE_PERMISSIONS");
    } else if (requiredScope.some((s) => !scope.includes(s)))
      throw new ForbiddenError(
        `Insufficient scope. Required are: ${requiredScope.join(", ")}`
      );

    return next();
    // hide values below minValue
  };
}

export function ResolvePlayer(
  argName: string,
  loggedInAs: boolean,
  opts?: {
    override?: Permissions;
    optional?: boolean;
    nullable?: boolean;
  }
): MiddlewareFn<Context> {
  return async function (res, next) {
    const resolved = res.context.resolved;
    const auth = res.context.auth;
    let playerId: string = res.args[argName];
    if (playerId.trim() === "@me") {
      if (!auth) throw new UnauthorizedError();
      else if (!auth.scope?.includes("player:read"))
        throw new UnauthorizedError(
          "The 'player:read' scope is required to use @me"
        );
      else if (!auth.playerId)
        throw new BadRequestError(
          "@me cant be used for users without a corresponding player."
        );
      playerId = auth.playerId;
    }

    if (playerId) {
      const player = await getPlayerFromId(playerId);
      if (!player && !opts?.nullable) throw new PlayerNotFoundError();
      if (loggedInAs) {
        if (!auth) throw new UnauthorizedError();
        else if (auth.playerId !== playerId) {
          auth.assurePerm(opts?.override ?? Permissions.ManagePlayers);
          auth.assureScope("USE_PERMISSIONS");
        }
      }
      resolved.player = player;
    } else if (!opts?.optional)
      throw new InternalServerError(`Could not find ${argName} as an argument`);
    return next();
  };
}

export function ResolveTeam(
  teamIdArg: string,
  tournamentIdArg: string,
  checkIf: { ownerOf?: boolean; playerOn?: boolean },
  override: Permissions = Permissions.ManageTeams,
  optional?: boolean
): MiddlewareFn<Context> {
  return async function (res, next) {
    const resolved = res.context.resolved;
    const auth = res.context.auth;
    const teamId = res.args[teamIdArg];
    const tournamentId = res.args[tournamentIdArg];
    if (teamId && tournamentId) {
      const team = await getTeamFromId(tournamentId, teamId);
      if (!team) throw new TeamNotFoundError();
      if (checkIf.ownerOf) {
        if (!auth) throw new UnauthorizedError();
        else if (auth.playerId !== team.ownerId) auth.assurePerm(override);
      }
      if (checkIf.playerOn) {
        if (!auth) throw new UnauthorizedError();
        else if (
          !team.teamPlayers.some(({ playerId }) => playerId === auth.playerId)
        )
          auth.assurePerm(override);
      }
      resolved.team = team;
    } else if (teamId || tournamentId) {
      throw new InternalServerError(
        `Please enter either both ${teamIdArg} and ${tournamentIdArg}${
          optional ? " or neither of them" : ""
        }.`
      );
    } else if (!optional)
      throw new InternalServerError(
        `Could not find ${teamIdArg} or ${tournamentIdArg} as arguments`
      );
    return next();
  };
}

export const SYSTEM_PLAYER_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";

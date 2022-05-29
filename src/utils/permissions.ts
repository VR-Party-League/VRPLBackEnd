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
  TournamentNotFoundError,
  UnauthorizedError,
} from "./errors";
import { getTeamFromId } from "../db/team";
import { getTournamentFromId } from "../db/tournaments";

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

// export function Scoped(): MethodAndPropDecorator;
// export function Scoped(scopes: AllOAuthScopes[]): MethodAndPropDecorator;
// export function Scoped(
//   scopes: AllOAuthScopes[]
// ): MethodDecorator | PropertyDecorator {
//   return (prototype, propertyKey, descriptor) => {
//     if (typeof propertyKey === "symbol") {
//       throw new SymbolKeysNotSupportedError();
//     }
//
//     getMetadataStorage().collectAuthorizedFieldMetadata({
//       target: prototype.constructor,
//       fieldName: propertyKey,
//       scopes,
//     });
//   };
// }

export function ScopeChecker(
  requiredScope: AllOAuthScopes[]
): MiddlewareFn<Context> {
  return async ({ context }, next) => {
    const auth = context.auth;
    const scope = auth?.scope || [];
    if (!auth) throw new UnauthorizedError();
    else if (requiredScope.some((s) => !scope.includes(s)))
      throw new ForbiddenError(
        `Insufficient scope. Required are: ${requiredScope.join(", ")}`
      );
    return next();
    // hide values below minValue
  };
}

export function PermissionChecker(
  permissions: Permissions[]
): MiddlewareFn<Context> {
  return async (res, next) => {
    console.log("resolver Data", res);
    const auth = res.context.auth;
    res.args;
    if (!auth) throw new UnauthorizedError();
    else if (
      !userHasOneOfPermissions({ permissions: auth.permissions }, permissions)
    )
      throw new ForbiddenError();
    return next();
    // hide values below minValue
  };
}

export function FetchArgs(opts: {
  player?: {
    playerIdArgName: string;
    /*
     * If not undefined, will check if the player fetched is the same as the logged in player,
     * and you enter a permission which can override that
     */
    checkIfLoggedInAs?: Permissions;
    optional?: boolean;
  };
  team?: {
    teamIdArgName: string;
    tournamentIdArgName: string;
    checkIfOwnerOf?: Permissions;
    checkIfPlayerOn?: Permissions;
    optional?: boolean;
  };
  tournament?: {
    tournamentIdArgName: string;
    optional?: boolean;
  };
}): MiddlewareFn<Context> {
  return async (res, next) => {
    const resolved = res.context.resolved;
    const auth = res.context.auth;
    const args = res.args;
    // if (!auth) throw new UnauthorizedError();
    if (opts.player) {
      const playerIdArgName = opts.player.playerIdArgName;
      const playerId = args[playerIdArgName];
      if (playerId) {
        const player = await getPlayerFromId(playerId);
        if (!player) throw new PlayerNotFoundError();
        if (opts.player.checkIfLoggedInAs) {
          if (!auth) throw new UnauthorizedError();
          else if (auth.playerId !== playerId)
            auth.assurePerm(opts.player.checkIfLoggedInAs);
        }
        resolved.player = player;
      } else if (!opts.player.optional)
        throw new InternalServerError(
          `Could not find ${playerIdArgName} as an argument`
        );
    }
    if (opts.team) {
      const teamOpt = opts.team;
      const teamId = args[teamOpt.teamIdArgName];
      const tournamentId = args[teamOpt.tournamentIdArgName];
      if (teamId && tournamentId) {
        const team = await getTeamFromId(tournamentId, teamId);
        if (!team) throw new TeamNotFoundError();
        if (opts.team.checkIfOwnerOf) {
          if (!auth) throw new UnauthorizedError();
          else if (auth.playerId !== team.ownerId)
            auth.assurePerm(opts.team.checkIfOwnerOf);
        }
        if (opts.team.checkIfPlayerOn) {
          if (!auth) throw new UnauthorizedError();
          else if (
            !team.teamPlayers.some(({ playerId }) => playerId === auth.playerId)
          )
            auth.assurePerm(opts.team.checkIfPlayerOn);
        }
        resolved.team = team;
      } else if ((teamId || tournamentId) && !opts.team.optional) {
        throw new InternalServerError(
          `Please enter both ${teamOpt.teamIdArgName} and ${
            teamOpt.tournamentIdArgName
          }${opts.team.optional ? " or none of them" : ""}.`
        );
      } else if (!opts.team.optional)
        throw new InternalServerError(
          `Could not find ${teamOpt.teamIdArgName} or ${teamOpt.tournamentIdArgName} as arguments`
        );
    }
    if (opts.tournament) {
      const tournamentId = args[opts.tournament.tournamentIdArgName];
      if (tournamentId) {
        const tournament = await getTournamentFromId(tournamentId);
        if (!tournament) throw new TournamentNotFoundError();
        resolved.tournament = tournament;
      } else if (!opts.tournament.optional)
        throw new InternalServerError(
          `Could not find ${opts.tournament.tournamentIdArgName} as an argument`
        );
    }
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
    if (playerId === "@me") {
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
        else if (auth.playerId !== playerId)
          auth.assurePerm(opts?.override ?? Permissions.ManagePlayers);
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

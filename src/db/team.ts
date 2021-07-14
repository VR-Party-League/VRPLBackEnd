import ms from "ms";
import VrplTeamDB, { VrplTeam } from "../db/models/vrplTeam";
import { v4 as uuidv4 } from "uuid";

let teamCacheTimeStamp: number = 0;
const teamCache = new Map<string, VrplTeam>();

function storeTeam(rawTeam: VrplTeam) {
  const team: VrplTeam = {
    id: rawTeam.id,
    name: rawTeam.name,
    captainID: rawTeam.captainID,
    playerIDs: rawTeam.playerIDs || [],
    pendingPlayerIDs: rawTeam.pendingPlayerIDs || [],
    tournamentId: rawTeam.tournamentId,
  };
  teamCache.set(team.id, team);
  return team;
}

export async function refreshTeams(force?: boolean): Promise<void> {
  if (teamCacheTimeStamp + ms("1hour") < Date.now() || force) {
    teamCacheTimeStamp = Date.now();
    const teams = await VrplTeamDB.find({});
    teamCache.clear();
    for (let rawTeam of teams) {
      storeTeam(rawTeam);
    }
  } else if (teamCacheTimeStamp + ms("15min") < Date.now()) {
    teamCacheTimeStamp = Date.now();
    VrplTeamDB.find({}).then((teams) => {
      teamCache.clear();
      for (let rawTeam of teams) {
        storeTeam(rawTeam);
      }
    });
  }
}

export async function getTeamsOfTournament(
  tournamentId: string
): Promise<VrplTeam[]> {
  const Teams = await filterTeams(tournamentId, () => true);
  return Teams;
}

export async function getTeamFromID(
  tournamentId: string,
  TeamID: string
): Promise<VrplTeam | undefined> {
  try {
    await refreshTeams();
    const team = teamCache.get(TeamID);
    if (team && team?.tournamentId == tournamentId) return team;
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}
type findFunc = (Team: VrplTeam) => boolean | undefined | null;
export async function findTeam(tournamentId: string, findFunc: findFunc) {
  await refreshTeams();
  const teamIterable = teamCache.values();
  for (const team of teamIterable) {
    if (team.tournamentId !== tournamentId) continue;
    else if (findFunc(team)) return team;
  }
  return null;
}
export async function filterTeams(tournamentId: string, filterFunc: findFunc) {
  await refreshTeams();
  const teamIterable = teamCache.values();
  const response = [];
  for (const team of teamIterable) {
    if (team.tournamentId !== tournamentId) continue;
    else if (filterFunc(team)) response.push(team);
  }
  return response;
}

export async function getTeamFromName(
  tournamentId: string,
  TeamName: string
): Promise<VrplTeam | null> {
  return (
    (await findTeam(tournamentId, (team) => team.name === TeamName)) ||
    (await findTeam(
      tournamentId,
      (team) => team.name.toLowerCase() === TeamName.toLowerCase()
    ))
  );
}

export async function destroyTeam(
  tournamentId: string,
  TeamID: string
): Promise<VrplTeam | undefined> {
  try {
    const team = await getTeamFromID(tournamentId, TeamID);
    if (team && team?.tournamentId == tournamentId) {
      teamCache.delete(team.id);
      await VrplTeamDB.deleteOne({ id: team.id });
      return team;
    }
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}
// export async function patchTeam(
//   Tournament: string,
//   TeamID: string,
//   newDoc: any,
//   opts?: { Invited: boolean }
// ): Promise<{
//   success: boolean;
//   error?: string | undefined;
//   doc?: VrplTeam | undefined;
// }> {
//   const OriginalTeam = await getTeamFromID(Tournament, TeamID);
//   if (!OriginalTeam) return { success: false, error: "Team doesn't exist" };
//   let update: UpdateWithAggregationPipeline | UpdateQuery<VrplTeam> = {};
//   let ToSet: any = {};

//   if (newDoc.TeamName) {
//     const validName = await validateTeamName(Tournament, newDoc.TeamName);
//     if (typeof validName !== "string")
//       return { success: false, error: "Invalid name: " + validName[0] };
//     ToSet.TeamName = validName;
//   }
//   if (newDoc.CaptainID) {
//     if (typeof newDoc.CaptainID !== "string")
//       return { success: false, error: "New captain isn't a string" };
//     const captain = await discordClient.users.fetch(newDoc.CaptainID);
//     if (!captain?.id)
//       return { success: false, error: "New captain not found in discord" };
//   }
//   let MemberIDs: string[] = [];
//   let PendingMemberIDs: string[] = [];
//   if (newDoc.MemberIDs) {
//     if (
//       typeof newDoc.MemberIDs !== "string" &&
//       newDoc.MemberIDs.length !== undefined
//     ) {
//       for (const member of newDoc.MemberIDs) {
//         if (
//           !member ||
//           typeof member !== "string" ||
//           !/^[0-9]{18}$/.test(member)
//         )
//           return { success: false, error: "Invalid member: " + member };

//         const isOriginalTeamMember = OriginalTeam.MemberIDs.includes(member);
//         const isTeamCaptain = OriginalTeam.CaptainID === member;
//         if (isTeamCaptain) {
//           return {
//             success: false,
//             error: "Captain cant be invited to the team",
//           };
//         } else if (isOriginalTeamMember || opts?.Invited) {
//           MemberIDs.push(member);
//         } else if (!PendingMemberIDs.includes(member)) {
//           PendingMemberIDs.push(member);
//           // TODO: send team join invite
//         }
//       }
//     } else {
//       return { success: false, error: "Invalid members array" };
//     }
//   }
//   if (newDoc.PendingMemberIDs) {
//     if (
//       typeof newDoc.PendingMemberIDs !== "string" &&
//       newDoc.PendingMemberIDs.length !== undefined
//     ) {
//       for (const pendingMember of newDoc.PendingMemberIDs) {
//         if (
//           !pendingMember ||
//           typeof pendingMember !== "string" ||
//           !/^[0-9]{18}$/.test(pendingMember)
//         )
//           return {
//             success: false,
//             error: "Invalid pending member: " + pendingMember,
//           };

//         const originalTeamMember =
//           OriginalTeam.MemberIDs.includes(pendingMember);
//         const isTeamCaptain = OriginalTeam.CaptainID === pendingMember;
//         if (isTeamCaptain) {
//           return {
//             success: false,
//             error: "Captain cant be invited to the team",
//           };
//         } else if (originalTeamMember || opts?.Invited) {
//           MemberIDs.push(pendingMember);
//         } else if (!PendingMemberIDs.includes(pendingMember)) {
//           PendingMemberIDs.push(pendingMember);
//           // TODO: send team join invite
//         }
//       }
//     } else {
//       return { success: false, error: "Invalid members array" };
//     }
//   }

//   update.$set = Object.assign(ToSet, { MemberIDs, PendingMemberIDs });
//   const NewTeam = await VrplTeamDB.findOneAndUpdate(
//     { TeamID: TeamID },
//     update,
//     {
//       new: true,
//     }
//   );
//   if (!NewTeam) {
//     teamCache.delete(TeamID);
//     console.trace();
//     console.error(newDoc);
//     return { success: false, error: "No team exists?" };
//   }
//   const team = storeTeam(NewTeam);
//   return { success: true, doc: team };
// }
export async function createTeam(
  tournamentId: string,
  TeamData: VrplTeam
): Promise<VrplTeam | undefined> {
  try {
    if (await getTeamFromID(tournamentId, TeamData.id)) {
      TeamData.id = uuidv4();
      return createTeam(tournamentId, TeamData);
    }
    const goodTeam = storeTeam(TeamData);
    const TeamModel = new VrplTeamDB(goodTeam);
    await TeamModel.save();
    return goodTeam;
  } catch (err) {
    console.trace();
    console.error(err);
    return undefined;
  }
}
// type findFunc = (Team: VrplTeam) => boolean | undefined | null;

// export async function findTeam(Tournament: string, findFunc: findFunc) {
//   await refreshTeams();
//   const teamIterable = teamCache.values();
//   for (const team of teamIterable) {
//     if (team.Tournament !== Tournament) continue;
//     else if (findFunc(team)) return team;
//   }
// }
// export async function filterTeams(Tournament: string, filterFunc: findFunc) {
//   await refreshTeams();
//   const teamIterable = teamCache.values();
//   const response = [];
//   for (const team of teamIterable) {
//     if (team.Tournament !== Tournament) continue;
//     else if (filterFunc(team)) response.push(team);
//   }
//   return response;
// }

// export async function validateTeamName(
//   Tournament: string,
//   raw: any
// ): Promise<string | [string, (string | undefined)?]> {
//   if (typeof raw !== "string") return ["TeamName is not a string"];

//   let TeamName = raw
//     .replace(/\s+/g, " ")
//     .replace(/^\s+|\s+$/, "")
//     .replace(/-+/, "-")
//     .replace(/_+/, "_")
//     .trim();
//   if (!/^[\w-_\s]+$/.test(TeamName)) return ["Invalid name", TeamName];
//   else if (TeamName.length < 5)
//     return ["TeamName must at least be 5 characters long", TeamName];
//   else if (TeamName.length > 25)
//     return [
//       "TeamName cannot be longer then 25 characters",
//       // The name can actually be "longer then 25 characters" because it is 25 characters long! :D
//       TeamName,
//     ];

//   // Check for other teams
//   const existingTeamName = await getTeamFromName(Tournament, TeamName);

//   if (existingTeamName) return ["Team name has been taken", TeamName];

//   return TeamName;
// }

import { VrplTournament } from "../models/vrplTournaments";
import * as fetch from "./fetch";
import { AnyBulkWriteOperation } from "mongodb";
import { teamUpdateRecord } from "../models/records/teamRecordTypes";
import { v4 as uuidv4 } from "uuid";
import VrplTeamDB, { SeededVrplTeam, VrplTeam } from "../models/vrplTeam";
import { storeAndBroadcastRecord, storeAndBroadcastRecords } from "../records";
import { InternalServerError } from "../../utils/errors";
import { recordType } from "../models/records";

export async function seedAllTeams(
  tournament: VrplTournament,
  performedById: string
  // random?: boolean
  // clearPrevious?: boolean
): Promise<SeededVrplTeam[]> {
  const teams = await fetch.getTeamsOfTournament(tournament.id);
  const notSeededTeams = teams.filter((team) => team.seed === undefined);
  const seededTeams = teams.filter((team) => team.seed !== undefined);
  if (notSeededTeams.length === 0) return teams as SeededVrplTeam[];
  const notSeededTeamsAmount = notSeededTeams.length;
  const seedsUsed = seededTeams.map((team) => team.seed) as number[];
  let seed = 0;

  const bulkWrites: AnyBulkWriteOperation<VrplTeam>[] = [];
  const records: teamUpdateRecord[] = [];

  while (true) {
    if (seedsUsed.includes(seed)) {
      seed++;
      continue;
    }
    const team = notSeededTeams.shift();
    seedsUsed.push(seed);
    if (!team) break;
    team.seed = seed;
    bulkWrites.push({
      updateOne: {
        filter: {
          id: team.id,
          tournamentId: team.tournamentId,
        },
        update: {
          $set: {
            seed: seed,
          },
        },
      },
    });
    records.push({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      tournamentName: tournament.name,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: seed,
      old: undefined,
      v: 1,
    });
  }

  const [res] = await Promise.all([
    VrplTeamDB.bulkWrite(bulkWrites),
    storeAndBroadcastRecords(records),
  ]);
  if (res.modifiedCount !== notSeededTeamsAmount)
    throw new InternalServerError(
      `Failed to seed teams, seeded ${res.modifiedCount} teams out of ${notSeededTeamsAmount} (${res.matchedCount} teams matched)`
    );
  return teams as SeededVrplTeam[];
}

export async function unSeedAllTeams(
  tournament: VrplTournament,
  performedById: string
) {
  const teams = await fetch.getTeamsOfTournament(tournament.id);
  const seededTeams = teams.filter((team) => team.seed !== undefined);
  const bulkWrites: AnyBulkWriteOperation<VrplTeam>[] = [];
  const records: teamUpdateRecord[] = [];
  seededTeams.forEach((team) => {
    records.push({
      id: uuidv4(),
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: undefined,
      old: team.seed,
      v: 1,
    });
    team.seed = undefined;
    bulkWrites.push({
      updateOne: {
        filter: {
          id: team.id,
          tournamentId: team.tournamentId,
        },
        update: {
          $unset: {
            seed: "",
          },
        },
      },
    });
  });

  const [res] = await Promise.all([
    VrplTeamDB.bulkWrite(bulkWrites),
    storeAndBroadcastRecords(records),
  ]);
  if (res.modifiedCount !== seededTeams.length)
    throw new InternalServerError(
      `Failed to unseed all teams, unseeded ${res.modifiedCount} teams out of ${seededTeams.length} (${res.matchedCount} teams matched)`
    );
  return teams as VrplTeam[];
}

export async function setTeamSeed(
  team: VrplTeam,
  seed: number,
  performedById: string
) {
  const [res] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        id: team.id,
        tournamentId: team.tournamentId,
      },
      {
        $set: {
          seed: seed,
        },
      }
    ),
    storeAndBroadcastRecord({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: seed,
      old: team.seed,
      v: 1,
    }),
  ]);
  if (res.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to set seed of team ${team.id} ${team.tournamentId}, (${res.matchedCount} teams matched, ${res.modifiedCount} modified)`
    );
  team.seed = seed;
  return team;
}

export async function clearTeamSeed(team: VrplTeam, performedById: string) {
  const [res] = await Promise.all([
    VrplTeamDB.updateOne(
      {
        id: team.id,
        tournamentId: team.tournamentId,
      },
      {
        $unset: {
          seed: "",
        },
      }
    ),
    storeAndBroadcastRecord({
      id: uuidv4(),
      tournamentId: team.tournamentId,
      teamId: team.id,
      timestamp: new Date(),
      type: recordType.teamUpdate,
      userId: performedById,
      valueChanged: `seed`,
      new: undefined,
      old: team.seed,
      v: 1,
    }),
  ]);
  if (res.modifiedCount !== 1)
    throw new InternalServerError(
      `Failed to clear seed of team ${team.id} ${team.tournamentId}, (${res.matchedCount} teams matched, ${res.modifiedCount} modified)`
    );

  team.seed = undefined;
  return team;
}

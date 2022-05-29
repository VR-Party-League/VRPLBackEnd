import dbRecord, { recordType, record } from "./models/records";
import io from "../utils/servers/socketIoServer";
import axios, { AxiosError } from "axios";
import { frontEndUrl } from "../index";
import { isRecordTeamRecord } from "./models/records/teamRecordTypes";
import {
  getAllTournaments,
  getTournamentFromId,
  getTournamentNameFromIdFromCache,
  tournamentsFromIds,
} from "./tournaments";
import { isRecordMatchRecord } from "./models/records/matchRecords";
import { InternalServerError } from "../utils/errors";
import { captureException } from "@sentry/node";
import { getAllTeamsOfPlayer } from "./team";

const revalidateSecret = process.env.FRONT_END_SECRET!;
if (!revalidateSecret) throw new Error("No revalidate secret found");

async function completeRecords(records: record[]): Promise<void> {
  for (const record of records) {
    if (isRecordTeamRecord(record) || isRecordMatchRecord(record)) {
      let tournamentName = getTournamentNameFromIdFromCache(
        record.tournamentId
      );
      if (!tournamentName) {
        const tournament = await getTournamentFromId(record.tournamentId);
        if (!tournament)
          throw new InternalServerError(
            `Could not get tournament from id ${record.tournamentId} when saving a record`
          );
        tournamentName = tournament.name;
      }
      record.tournamentName = tournamentName;
    }
  }
}

function cleanRecord(record: record) {
  let cleanedRecord: any = Object.assign({}, record);
  if (isRecordTeamRecord(record)) {
    cleanedRecord.team = undefined;
  }
  return cleanedRecord;
}

function cleanRecords(records: record[]): any[] {
  const cleanedRecords: record[] = records.map((record) => cleanRecord(record));
  return cleanedRecords;
}

export async function storeAndBroadcastRecord(record: record) {
  await completeRecords([record]);
  const dbEntry = new dbRecord(cleanRecord(record));
  await dbEntry.save();
  Promise.resolve(broadcastRecords([record]));
}

export async function storeRecord(record: record) {
  await completeRecords([record]);
  const dbEntry = new dbRecord(cleanRecord(record));
  await dbEntry.save();
}

async function broadcastRecords(records: record[]) {
  let paths_to_revalidate: string[] = [];
  for (let record of records) {
    const type = recordType[record.type].toString();
    io.sockets.emit(type, record);
    if (
      record.type === recordType.playerUpdate ||
      record.type === recordType.playerDelete
    ) {
      paths_to_revalidate.push(`/player/${record.playerId}`);
      const playerTeams = await getAllTeamsOfPlayer(record.playerId);
      const tournamentIds: string[] = playerTeams.map(
        (team) => team.tournamentId
      );
      let tournamentNames = tournamentIds.map((id) => ({
        id: id,
        name: getTournamentNameFromIdFromCache(id),
      }));
      if (tournamentNames.some((t) => !t.name)) {
        const tournaments = await tournamentsFromIds(tournamentIds);
        tournamentNames = tournaments.map((t) => ({ id: t.id, name: t.name }));
      }

      for (let team of playerTeams) {
        const tournamentName = tournamentNames.find(
          (t) => t.id === team.tournamentId
        );
        if (!tournamentName) {
          console.error(
            `Could not find tournament name for ${team.tournamentId}`
          );
          captureException(
            new InternalServerError(
              "Could not find tournament name for " + team.tournamentId
            )
          );
          continue;
        }
        paths_to_revalidate.push(
          `/tournament/${tournamentName.name}/team/${team.id}`
        );
      }
    } else if (isRecordTeamRecord(record)) {
      paths_to_revalidate.push(
        `/tournament/${record.tournamentName}/team/${record.teamId}`
      );
      const { team } = record;
      const playerIds = [
        team.ownerId,
        ...team.teamPlayers.map((teamPlayer) => teamPlayer.playerId),
      ].filter((playerId, index, self) => self.indexOf(playerId) === index);

      for (let playerId of playerIds) {
        paths_to_revalidate.push(`/player/${playerId}`);
      }
    } else if (isRecordMatchRecord(record)) {
      const teamIds = record.teamIds;
      for (let teamId of teamIds) {
        paths_to_revalidate.push(
          `/tournament/${record.tournamentName}/team/${teamId}`
        );
      }
    }
  }
  if (paths_to_revalidate.length === 0) return;
  console.log("Revalidating", paths_to_revalidate);
  try {
    const request = {
      secret: revalidateSecret,
      paths: paths_to_revalidate.filter((v, i, a) => a.indexOf(v) === i),
    };

    await axios.post(frontEndUrl + "/api/revalidate", request);
  } catch (err) {
    const error = err as AxiosError;
    captureException(error);
    console.error("Error revalidating frontend", error.response!.data);
  }
}

export async function storeAndBroadcastRecords(records: record[]) {
  await completeRecords(records);
  await dbRecord.insertMany(cleanRecords(records));
  Promise.resolve(broadcastRecords(records));
}

export async function revalidatePlayerPages(playerIds: string[]) {
  const paths = playerIds.map((playerId) => `/player/${playerId}`);
  const request = {
    secret: revalidateSecret,
    paths,
  };
  await axios.post(frontEndUrl + "/api/revalidate", request);
}

export async function revalidateTeamPages(
  teams: { tournamentName: string; teamId: string }[]
) {
  const paths = teams.map(
    (team) => `/tournament/${team.tournamentName}/team/${team.teamId}`
  );
  const request = {
    secret: revalidateSecret,
    paths,
  };
  await axios.post(frontEndUrl + "/api/revalidate", request);
}

export async function revalidateTournamentPage(
  tournamentName: string
): Promise<void> {
  const request = {
    secret: revalidateSecret,
    paths: [`/tournament/${tournamentName}`],
  };
  await axios.post(frontEndUrl + "/api/revalidate", request);
}

export async function revalidateGamePage(gameName: string): Promise<void> {
  const request = {
    secret: revalidateSecret,
    paths: [`/game/${gameName}`],
  };
  await axios.post(frontEndUrl + "/api/revalidate", request);
}

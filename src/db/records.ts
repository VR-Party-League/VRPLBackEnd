import dbRecord, { recordType, record } from "./models/records";
import io from "../utils/servers/socketIoServer";
import axios, { AxiosError } from "axios";
import { frontEndUrl } from "../index";
import {
  isRecordTeamRecord,
  teamRecords,
} from "./models/records/teamRecordTypes";
import {
  getTournamentFromId,
  getTournamentNameFromIdFromCache,
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
    if (record.type === recordType.playerUpdate) {
      paths_to_revalidate.push(`/player/${record.playerId}`);
      const playerTeams = await getAllTeamsOfPlayer(record.playerId);
      for (let team of playerTeams) {
        paths_to_revalidate.push(
          `/tournament/${team.tournamentId}/team/${team.id}`
        );
      }
    } else if (record.type === recordType.teamUpdate) {
      paths_to_revalidate.push(
        `/tournament/${record.tournamentName}/team/${record.teamId}`
      );
      const { team } = record;
      const playerIds = [
        team.ownerId,
        ...team.teamPlayers.map((teamPlayer) => teamPlayer.playerId),
      ];
      for (let playerId of playerIds) {
        paths_to_revalidate.push(`/player/${playerId}`);
      }
    }
  }
  if (paths_to_revalidate.length === 0) return;
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

import {
  Arg,
  Authorized,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { projects, tasks, ProjectData } from "../data";
import { VrplMatch } from "../db/models/vrplMatch";
import { VrplPlayer } from "../db/models/vrplPlayer";
import { VrplTeam } from "../db/models/vrplTeam";
import { VrplTournament } from "../db/models/vrplTournaments";
import { getPlayerFromId } from "../db/player";
import { createTeam, getTeamFromId, getTeamFromName } from "../db/team";
import { getTournamentFromId } from "../db/tournaments";
import { BadRequestError } from "../errors";
import Match from "../schemas/Match";
import Team from "../schemas/Team";

@Resolver((of) => Match)
export default class {}

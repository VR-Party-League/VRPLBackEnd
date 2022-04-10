import {
  discordInviteRegex,
  twitchRegex,
  twitterRegex,
  youtubeChannelRegex,
} from "../../utils/regex/team";
import { BadRequestError, InternalServerError } from "../../utils/errors";
import { teamUpdateRecord } from "../models/records/teamRecordTypes";
import { v4 as uuidv4 } from "uuid";
import VrplTeamDB, { SocialPlatform, VrplTeam } from "../models/vrplTeam";
import { storeAndBroadcastRecord } from "../records";
import { recordType } from "../models/records";

export async function addSocialAccountToTeam(
  team: VrplTeam,
  platform: SocialPlatform,
  code: string,
  performedById: string
) {
  switch (platform) {
    case "twitch":
      if (!twitchRegex.test(code))
        throw new BadRequestError("Invalid twitch channel name");
      break;
    case "youtube":
      if (!youtubeChannelRegex.test(code))
        throw new BadRequestError("Invalid youtube channel ID");
      break;
    case "twitter":
      if (!twitterRegex.test(code))
        throw new BadRequestError("Invalid twitter handle");
      break;
    // case "instagram":
    //   if (!instagramRegex.test(code))
    //     throw new BadRequestError("Invalid instagram handle");
    //   break;
    // case "facebook":
    //   if (!facebookRegex.test(code))
    //     throw new BadRequestError("Invalid facebook handle");
    //   break;
    case "discord":
      if (!discordInviteRegex.test(code))
        throw new BadRequestError("Invalid discord invite code");
      break;
    // case website:
    //   team.website = code;
    //   break;
    default:
      throw new BadRequestError("Invalid social platform");
  }

  const oldSocials = Object.assign({}, team.socials);
  team.socials[platform] = code;
  const UpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: team.tournamentId,
    teamId: team.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    userId: performedById,
    valueChanged: `socials`,
    new: team.socials,
    old: oldSocials,
    v: 1,
  };
  const UpdatePromise = VrplTeamDB.findOne()
    .updateOne(
      {
        tournamentId: team.tournamentId,
        id: team.id,
      },
      { $set: { [`socials.${platform}`]: code } }
    )
    .exec();
  const [updateRes] = await Promise.all([
    UpdatePromise,
    storeAndBroadcastRecord(UpdateRecord),
  ]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("No team matched when updating socials");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("No team modified when updating socials");
  return team;
}

export async function removeSocialAccountFromTeam(
  team: VrplTeam,
  platform: SocialPlatform,
  performedById: string
): Promise<VrplTeam> {
  const oldSocials = Object.assign({}, team.socials);
  team.socials[platform] = undefined;
  const UpdateRecord: teamUpdateRecord = {
    id: uuidv4(),
    tournamentId: team.tournamentId,
    teamId: team.id,
    timestamp: new Date(),
    type: recordType.teamUpdate,
    userId: performedById,
    valueChanged: `socials`,
    new: team.socials,
    old: oldSocials,
    v: 1,
  };
  const UpdatePromise = VrplTeamDB.findOne()
    .updateOne(
      {
        tournamentId: team.tournamentId,
        id: team.id,
      },
      { $unset: { [`socials.${platform}`]: "" } }
    )
    .exec();
  const [updateRes] = await Promise.all([
    UpdatePromise,
    storeAndBroadcastRecord(UpdateRecord),
  ]);
  if (updateRes.matchedCount === 0)
    throw new InternalServerError("No team matched when removing socials");
  else if (updateRes.modifiedCount === 0)
    throw new InternalServerError("No team modified when removing socials");
  return team;
}

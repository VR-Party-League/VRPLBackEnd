import { MessageInput } from "../schemas/Message";
import MessageModel, {
  MessageButtonActions,
  MessageButtonActionTypes,
  vrplMessage,
  vrplMessageButton,
} from "./models/vrplMessages";
import { VrplTeamPlayerRole } from "./models/vrplTeam";
import { getPlayerFromId, howManyOfThesePlayersExist } from "./player";
import { addPlayerToTeam, getTeamFromId, removePlayersFromTeam } from "./team";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError, InternalServerError } from "../utils/errors";
import { VrplPlayer } from "./models/vrplPlayer";
import { VrplAuth } from "../index";

export async function getMessageFromId(
  messageId: string
): Promise<vrplMessage | null> {
  const result = await MessageModel.findOne({
    id: messageId,
  });
  return result;
}

export async function getButtonFromId(buttonId: string, messageId: string) {
  const result = await MessageModel.findOne({
    id: messageId,
    "buttons.id": buttonId,
  });
  return result;
}

export async function performButtonAction(
  button: vrplMessageButton,
  message: vrplMessage,
  player: VrplPlayer,
  auth: VrplAuth
): Promise<{ text: string | undefined; message: vrplMessage }> {
  const messageId = message.id;
  const action = button.action;
  let responseText: string | undefined = undefined;
  if (message.isPickOne && message.buttons.some((b) => !!b.clickedAt))
    throw new BadRequestError(
      "A button has already been clicked for this pickOne message"
    );
  const newMessage = await storeClickedButton(button, messageId);
  if (action.type === MessageButtonActionTypes.AcceptTeamInvite) {
    const { teamId, tournamentId } = action;
    // Check if the user has an invite to the team
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new InternalServerError("Team not found");
    else if (!player) throw new InternalServerError("Player not found");
    const teamPlayer = team.teamPlayers.find(
      (teamPlayer) =>
        teamPlayer.playerId === player.id &&
        teamPlayer.role === VrplTeamPlayerRole.Pending
    );
    if (!teamPlayer)
      throw new BadRequestError("Player not found in team or not pending");
    else if (teamPlayer.role === VrplTeamPlayerRole.Pending) {
      const res = addPlayerToTeam(team, player.id, action.role, auth);
      if (!res) throw new InternalServerError("Player not added to team");
      responseText = `You have been successfully added to the team '${team.name}'!`;
    } else {
      throw new BadRequestError("Player is not a pending player for that team");
    }
  } else if (action.type === MessageButtonActionTypes.DeclineTeamInvite) {
    const { teamId, tournamentId } = action;
    // Check if the user has an invite to the team
    const team = await getTeamFromId(tournamentId, teamId);
    if (!team) throw new InternalServerError("Team not found");
    else if (!player) throw new InternalServerError("Player not found");
    await removePlayersFromTeam(team, [player.id], auth);
    responseText = `Successfully declined the invite to the team '${team.name}'`;
  } else if (action.type === MessageButtonActionTypes.Debug) {
    console.log("HEYO DEBUG BUTTON CLICKED!!!!");
    responseText = `<DEBUG_ROBOT_ACTIVATED>\n<SEARCHING_TARGET>\n<TARGET_FOUND>\n<ELIMINATING_TARGET>\n<AAAAAAAAAAAA>`;
  }
  return { text: responseText, message: newMessage };
}

async function storeClickedButton(
  button: vrplMessageButton,
  messageId: string
) {
  const result = await MessageModel.findOneAndUpdate(
    {
      id: messageId,
      buttons: { $elemMatch: { id: button.id, clickedAt: null } },
    },
    {
      "buttons.$.clickedAt": new Date(),
    },
    { new: true }
  );
  if (!result) throw new BadRequestError("Button not found or already clicked");
  return result;
}

export async function createMessages(
  messageInput: MessageInput,
  recipients: string[]
) {
  const count = await howManyOfThesePlayersExist(recipients);
  if (count !== recipients.length)
    throw new BadRequestError(
      `Some of the players don't exist. You entered ${recipients.length} recipients, only ${count} exist`
    );
  const messages: vrplMessage[] = recipients.map(
    (recipient) =>
      ({
        id: uuidv4(),
        title: messageInput.title,
        isPickOne: messageInput.isPickOne,
        content: messageInput.content,
        senderId: messageInput.senderId,
        recipientId: recipient,
        createdAt: new Date(),
        buttons: messageInput.buttons.map((buttonInput) => {
          const actionInput = buttonInput.action;
          const actionType = actionInput.type;

          let action: MessageButtonActions;
          if (
            actionType === MessageButtonActionTypes.AcceptTeamInvite ||
            actionType === MessageButtonActionTypes.DeclineTeamInvite
          ) {
            if (!actionInput.teamId)
              throw new BadRequestError(
                `teamId required for the button action '${actionType}'`
              );
            else if (!actionInput.tournamentId)
              throw new BadRequestError(
                `tournamentId required for the button action '${actionType}'`
              );

            action = {
              type: actionType,
              teamId: actionInput.teamId,
              tournamentId: actionInput.tournamentId,
              role: actionInput.role!,
              // FIXME: fix this    ^
            };
          } else if (actionType === MessageButtonActionTypes.Debug) {
            action = {
              type: actionType,
            };
          } else
            throw new BadRequestError(`Unknown button action '${actionType}'`);

          const button: vrplMessageButton = {
            id: uuidv4(),
            text: buttonInput.text,
            colorHex: buttonInput.colorHex,
            icon: buttonInput.icon,
            action: action,
          };
          return button;
        }),
      } as vrplMessage)
  );
  const res = await MessageModel.insertMany(messages);
  return res;
}

export async function getMessagesForPlayer(
  playerId: string,
  limit: number = 10,
  skip: number = 0,
  showHidden: boolean = false
) {
  const result = await MessageModel.find({
    recipientId: playerId,
    hiddenAt: !showHidden ? { $exists: false } : undefined,
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  return result;
}

export async function getMessageForPlayerFromId(
  playerId: string,
  messageId: string
) {
  const result = await MessageModel.findOne({
    recipientId: playerId,
    id: messageId,
  });
  return result;
}

export async function readMessagesOfPlayer(
  playerId: string,
  limit: number = 10,
  reverse: boolean = false,
  messageIds: string[]
) {
  const toUpdateIds =
    messageIds ||
    (
      await MessageModel.find(
        {
          recipientId: playerId,
          readAt: { $exists: false },
        },
        { id: 1, createdAt: 1 }
      )
        .sort(reverse ? { createdAt: 1 } : { createdAt: -1 })
        .limit(limit)
    ).map((message) => message.id);

  const res = await MessageModel.updateMany(
    {
      id: { $in: toUpdateIds },
      readAt: { $exists: false },
      recipientId: playerId,
    },
    {
      $set: { readAt: new Date() },
    }
  );
  return res;
}

export async function hideMessage(player: VrplPlayer, message: vrplMessage) {
  const result = await MessageModel.findOneAndUpdate(
    {
      id: message.id,
      recipientId: player.id,
      hiddenAt: { $exists: false },
    },
    {
      $set: { hiddenAt: new Date() },
    },
    { new: true }
  );
  return result;
}

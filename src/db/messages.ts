import { MessageInput } from "../schemas/Message";
import MessageModel, {
  vrplMessage,
  vrplMessageButton,
  MessageButtonActionTypes,
  MessageButtonActions,
} from "./models/vrplMessages";
import { VrplTeamPlayerRole } from "./models/vrplTeam";
import { getPlayerFromId, howManyOfThesePlayersExist } from "./player";
import { addPlayerToTeam, getTeamFromId } from "./team";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError, InternalServerError } from "../utils/errors";

async function getMessageFromId(
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
  messageId: string,
  performedBy: string
): Promise<vrplMessage | undefined> {
  const action = button.action;
  const newMessage = await storeClickedButton(button, messageId);
  if (action.type === MessageButtonActionTypes.AcceptTeamInvite) {
    const { teamId, tournamentId } = action;
    // Check if the user has an invite to the team
    const [team, player] = await Promise.all([
      getTeamFromId(tournamentId, teamId),
      getPlayerFromId(performedBy),
    ]);

    if (!team) throw new Error("Team not found");
    else if (!player) throw new Error("Player not found");
    const teamPlayer = team.teamPlayers.find(
      (teamPlayer) => teamPlayer.playerId === player.id
    );
    if (!teamPlayer) throw new Error("Player not found in team");
    else if (teamPlayer.role === VrplTeamPlayerRole.Pending) {
      const res = await addPlayerToTeam(
        tournamentId,
        team,
        player.id,
        VrplTeamPlayerRole.Player,
        performedBy
      );
      if (!res) throw new InternalServerError("Player not added to team");
    } else {
      throw new BadRequestError("Player is not a pending player for that team");
    }
  } else if (action.type === MessageButtonActionTypes.Debug) {
    console.log("HEYO DEBUG BUTTON CLICKED!!!!");

    // TODO: Send a message bek or something
  }
  return newMessage;
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
      // TODO: test this
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

  console.log("toUpdateIds", toUpdateIds);
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
  console.log("res", res);
  return res;
}

export async function hideMessage(playerId: string, messageId: string) {
  const result = await MessageModel.findOneAndUpdate(
    {
      id: messageId,
      recipientId: playerId,
      hiddenAt: { $exists: false },
    },
    {
      $set: { hiddenAt: new Date() },
    },
    { new: true }
  );
  return result;
}

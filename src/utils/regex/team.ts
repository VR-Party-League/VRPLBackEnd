const emailRegex = new RegExp(
  "^http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+$"
);

export const twitchRegex = new RegExp("^[a-zA-Z0-9]{4,25}$");
export const youtubeChannelRegex = new RegExp(
  "^c(?:hannel)?\\/[a-zA-Z0-9_\\-]{3,24}$"
);
export const twitterRegex = new RegExp("^[A-Za-z0-9_]{4,15}$");
// export const instagramRegex = new RegExp(
//   "^[\\w](?!.*?\\.{2})[\\w.]{1,28}[\\w]$"
// );

// export const facebookRegex = new RegExp("^[a-z\\d.]{5,}$", "i");

export const discordInviteRegex = new RegExp("^[a-zA-Z0-9]{4,25}$");

import { Client } from "discord.js";

const client = new Client({
  intents: ["GUILDS", "GUILD_MEMBERS"],
});
console.log("Created discord client");
client.login(process.env.TOKEN);
export default client;

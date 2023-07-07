import { Client } from "discord.js";

const client = new Client({
  intents: ["Guilds", "GuildMembers"],
});
console.log("Created discord client");
client.login(process.env.TOKEN);
export default client;

import { Client } from "discord.js";
const client = new Client();
console.log("Created discord client");
client.login(process.env.TOKEN);
export default client;

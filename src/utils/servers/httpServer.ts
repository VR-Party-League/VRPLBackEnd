import http from "http";
import app from "./expresServer";

const server = new http.Server(app);
console.log("Created HTTP server");
export default server;

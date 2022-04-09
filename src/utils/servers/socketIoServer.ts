import socketIO from "socket.io";
import server from "./httpServer";
import { AuthenticateSocketIO } from "../authentication/jwt";
import { recordType } from "../../db/models/records";

const io = new socketIO.Server();
console.log("Socket.io server started");
io.use(AuthenticateSocketIO);
let clients = 0;
io.on("connection", (socket) => {
  clients++;
  console.log("A client connected", socket.id);
  socket.on("ping", () => {
    socket.emit("pong");
  });

  socket.on("info", () => {
    socket.emit("info", {
      clients: clients,
      recordTypes: Object.values(recordType).filter(
        (r) => typeof r === "string"
      ),
    });
  });

  socket.on("disconnect", () => {
    clients--;
  });
});
export default io;

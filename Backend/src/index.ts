import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", function (socket) {
  console.log("user connected");

  socket.on("message", (e) => {
    const message = e.toString();
    console.log("Received:", message);

    if (message === "ping") {
      socket.send("pong");
    }
  });
});
import express from "express";
import { WebSocketServer } from "ws";

const app = express();
const server = app.listen(3000);
const wss = new WebSocketServer({ server });

wss.on("connection", ws =>
  ws.on("message", msg =>
    wss.clients.forEach(c => c.send(msg.toString()))
  )
);
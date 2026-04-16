import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let userCount = 0;
let clients = []; 

wss.on("connection", (socket) => {
    userCount++;
    clients.push(socket);

    console.log("Users connected:", userCount);

    socket.on("message", (event) => {
        const message = event.toString();
        console.log("Message received:", message);

        clients.forEach((client) => {
            if (client.readyState === 1) { 
                client.send(message + " : broadcast from server");
            }
        });
    });

    socket.on("close", () => {
        userCount--;

        clients = clients.filter((client) => client !== socket);

        console.log("Users connected:", userCount);
    });
});
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

let userCount = 0;

type SocketEntry = {
    socket: WebSocket;
    roomId: string | null;
};

type IncomingMessage = {
    type: "join" | "chat";
    payload?: {
        roomId?: string;
        message?: string;
    };
};

let clients: SocketEntry[] = [];

wss.on("connection", (socket) => {
    userCount++;
    clients.push({ socket, roomId: null });

    console.log("Users connected:", userCount);
 
    socket.on("message", (event) => {
        const rawMessage = event.toString();

        let parsedMessage: IncomingMessage;
        try {
            parsedMessage = JSON.parse(rawMessage) as IncomingMessage;
        } catch {
            socket.send(JSON.stringify({ error: "Invalid JSON message format" }));
            return;
        }

        if (parsedMessage.type === "join") {
            const roomId = parsedMessage.payload?.roomId;
            if (!roomId) {
                socket.send(JSON.stringify({ error: "roomId is required for join" }));
                return;
            }

            clients = clients.map((client) => {
                if (client.socket === socket) {
                    return { ...client, roomId };
                }
                return client;
            });

            socket.send(JSON.stringify({ type: "joined", payload: { roomId } }));
            return;
        }

        if (parsedMessage.type === "chat") {
            const sender = clients.find((client) => client.socket === socket);
            const message = parsedMessage.payload?.message;

            if (!sender?.roomId) {
                socket.send(JSON.stringify({ error: "Join a room before chatting" }));
                return;
            }

            if (!message) {
                socket.send(JSON.stringify({ error: "message is required for chat" }));
                return;
            }

            clients.forEach((client) => {
                if (client.roomId === sender.roomId && client.socket.readyState === 1) {
                    client.socket.send(
                        JSON.stringify({
                            type: "chat",
                            payload: {
                                roomId: sender.roomId,
                                message
                            }
                        })
                    );
                }
            });
        }
    });

    socket.on("close", () => {
        userCount--; 

        clients = clients.filter((client) => client.socket !== socket);

        console.log("Users connected:", userCount);
    });
});
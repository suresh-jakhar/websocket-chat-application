import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

// ==================== DATA STRUCTURES ====================

// Room counter for auto-incrementing room IDs
let roomCounter = 0;

// All active rooms: roomId -> Set of users in that room
type User = {
    socket: WebSocket;
    anonymousId: string;
    nickname: string;
    socketId: string;
};

const rooms = new Map<number, Set<User>>();

// Quick lookup: socketId -> roomId
const userToRoom = new Map<string, number>();

// ==================== TYPE DEFINITIONS ====================

type IncomingMessage =
    | { type: "CREATE_ROOM"; payload: { anonymousId: string; nickname: string } }
    | { type: "JOIN_ROOM"; payload: { roomId: number; anonymousId: string; nickname: string } }
    | { type: "LEAVE_ROOM"; payload: { roomId: number } }
    | { type: "SEND_MESSAGE"; payload: { message: string } }
    | { type: "GET_ROOMS"; payload?: object };

type OutgoingMessage =
    | { type: "ERROR"; payload: { error: string } }
    | { type: "SUCCESS"; payload: { message: string; [key: string]: unknown } }
    | { type: "ROOM_CREATED"; payload: { roomId: number } }
    | { type: "ROOM_JOINED"; payload: { roomId: number; userCount: number } }
    | { type: "USER_JOINED"; payload: { anonymousId: string; nickname: string; userCount: number } }
    | { type: "USER_LEFT"; payload: { anonymousId: string; nickname: string; userCount: number } }
    | { type: "MESSAGE"; payload: { anonymousId: string; nickname: string; message: string; timestamp: string } }
    | { type: "ROOM_LIST"; payload: { rooms: Array<{ roomId: number; userCount: number }> } };

// ==================== HELPERS ====================

function generateSocketId(): string {
    return `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sendMessage(socket: WebSocket, message: OutgoingMessage) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

function broadcastToRoom(roomId: number, message: OutgoingMessage, excludeSocket?: WebSocket) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.forEach((user) => {
        if (excludeSocket && user.socket === excludeSocket) return;
        sendMessage(user.socket, message);
    });
}

function validateNickname(nickname: string): { valid: boolean; error?: string } {
    if (!nickname || typeof nickname !== "string") {
        return { valid: false, error: "Nickname is required" };
    }
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: "Nickname cannot be empty" };
    }
    if (trimmed.length > 30) {
        return { valid: false, error: "Nickname must be 30 characters or less" };
    }
    return { valid: true };
}

function validateAnonymousId(anonymousId: string): { valid: boolean; error?: string } {
    if (!anonymousId || typeof anonymousId !== "string") {
        return { valid: false, error: "anonymousId is required" };
    }
    if (anonymousId.trim().length === 0) {
        return { valid: false, error: "anonymousId cannot be empty" };
    }
    return { valid: true };
}

// ==================== WEBSOCKET HANDLERS ====================

wss.on("connection", (socket) => {
    const socketId = generateSocketId();
    console.log(`[Connection] ${socketId} connected. Total connections: ${wss.clients.size}`);

    socket.on("message", (data) => {
        try {
            const parsedMessage = JSON.parse(data.toString()) as IncomingMessage;
            console.log(`[Message] ${socketId} sent:`, parsedMessage.type);

            // ==================== CREATE_ROOM HANDLER ====================
            if (parsedMessage.type === "CREATE_ROOM") {
                const { anonymousId, nickname } = parsedMessage.payload;

                // Validate anonymousId
                const anonValidation = validateAnonymousId(anonymousId);
                if (!anonValidation.valid) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: anonValidation.error! },
                    });
                    return;
                }

                // Validate nickname
                const nickValidation = validateNickname(nickname);
                if (!nickValidation.valid) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: nickValidation.error! },
                    });
                    return;
                }

                // Create new room
                roomCounter++;
                const newRoomId = roomCounter;
                const newRoom = new Set<User>();
                rooms.set(newRoomId, newRoom);

                console.log(
                    `[CREATE_ROOM] Room ${newRoomId} created by ${nickname} (${anonymousId})`
                );

                // Send success response
                sendMessage(socket, {
                    type: "ROOM_CREATED",
                    payload: { roomId: newRoomId },
                });
            }

            // Placeholder for other handlers
            else {
                sendMessage(socket, {
                    type: "ERROR",
                    payload: { error: `Handler for ${parsedMessage.type} not yet implemented` },
                });
            }
        } catch (error) {
            console.error(`[Error] ${socketId} sent invalid JSON:`, error);
            sendMessage(socket, {
                type: "ERROR",
                payload: { error: "Invalid JSON format" },
            });
        }
    });

    socket.on("close", () => {
        console.log(`[Disconnect] ${socketId} disconnected`);
        userToRoom.delete(socketId);
        // Cleanup will be implemented in Plan 5
    });

    socket.on("error", (error) => {
        console.error(`[Error] ${socketId} socket error:`, error);
    });
});

console.log("WebSocket server started on port 8080");
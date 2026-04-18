import { config } from "dotenv";
import { WebSocketServer, WebSocket } from "ws";

config();

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const wss = new WebSocketServer({ port: PORT, host: HOST });

let roomCounter = 0;

type User = {
    socket: WebSocket;
    anonymousId: string;
    nickname: string;
    socketId: string;
};

const rooms = new Map<number, Set<User>>();
const userToRoom = new Map<string, number>();

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

function validateRoomId(roomId: unknown): { valid: boolean; error?: string } {
    if (typeof roomId !== "number") {
        return { valid: false, error: "roomId must be a number" };
    }
    if (!rooms.has(roomId)) {
        return { valid: false, error: `Room ${roomId} does not exist` };
    }
    return { valid: true };
}

function validateMessage(message: string): { valid: boolean; error?: string } {
    if (!message || typeof message !== "string") {
        return { valid: false, error: "Message is required" };
    }
    const trimmed = message.trim();
    if (trimmed.length === 0) {
        return { valid: false, error: "Message cannot be empty" };
    }
    if (trimmed.length > 500) {
        return { valid: false, error: "Message must be 500 characters or less" };
    }
    return { valid: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sendValidationError(socket: WebSocket, error: string) {
    sendMessage(socket, {
        type: "ERROR",
        payload: { error },
    });
}

function formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

function removeUserFromRoom(socketId: string): { roomId: number; userCount: number; user: User } | null {
    const roomId = userToRoom.get(socketId);
    if (!roomId) return null;

    const room = rooms.get(roomId);
    if (!room) return null;

    let userToRemove: User | undefined;
    room.forEach((user) => {
        if (user.socketId === socketId) {
            userToRemove = user;
        }
    });

    if (!userToRemove) return null;

    room.delete(userToRemove);
    userToRoom.delete(socketId);

    const userCount = room.size;

    if (userCount === 0) {
        rooms.delete(roomId);
        console.log(`[ROOM_CLEANUP] Room ${roomId} deleted (empty)`);
    }

    return { roomId, userCount, user: userToRemove };
}

wss.on("connection", (socket) => {
    const socketId = generateSocketId();
    console.log(`[Connection] ${socketId} connected. Total connections: ${wss.clients.size}`);

    socket.on("message", (data) => {
        try {
            const parsedMessage = JSON.parse(data.toString()) as { type?: string; payload?: unknown };

            if (!parsedMessage || typeof parsedMessage.type !== "string") {
                sendValidationError(socket, "Message type is required");
                return;
            }

            const payload = isRecord(parsedMessage.payload) ? parsedMessage.payload : null;

            if (parsedMessage.type === "CREATE_ROOM") {
                if (!payload) {
                    sendValidationError(socket, "Payload is required");
                    return;
                }

                const anonymousId = payload.anonymousId;
                const nickname = payload.nickname;

                if (typeof anonymousId !== "string" || typeof nickname !== "string") {
                    sendValidationError(socket, "anonymousId and nickname are required");
                    return;
                }

                const anonValidation = validateAnonymousId(anonymousId);
                if (!anonValidation.valid) {
                    sendValidationError(socket, anonValidation.error!);
                    return;
                }

                const nickValidation = validateNickname(nickname);
                if (!nickValidation.valid) {
                    sendValidationError(socket, nickValidation.error!);
                    return;
                }

                roomCounter++;
                const newRoomId = roomCounter;
                rooms.set(newRoomId, new Set<User>());

                console.log(`[CREATE_ROOM] Room ${newRoomId} created by ${nickname} (${anonymousId})`);

                sendMessage(socket, {
                    type: "ROOM_CREATED",
                    payload: { roomId: newRoomId },
                });
            } else if (parsedMessage.type === "JOIN_ROOM") {
                if (!payload) {
                    sendValidationError(socket, "Payload is required");
                    return;
                }

                const roomId = payload.roomId;
                const anonymousId = payload.anonymousId;
                const nickname = payload.nickname;

                if (typeof roomId !== "number") {
                    sendValidationError(socket, "roomId must be a number");
                    return;
                }

                if (typeof anonymousId !== "string" || typeof nickname !== "string") {
                    sendValidationError(socket, "anonymousId and nickname are required");
                    return;
                }

                const roomValidation = validateRoomId(roomId);
                if (!roomValidation.valid) {
                    sendValidationError(socket, roomValidation.error!);
                    return;
                }

                const anonValidation = validateAnonymousId(anonymousId);
                if (!anonValidation.valid) {
                    sendValidationError(socket, anonValidation.error!);
                    return;
                }

                const nickValidation = validateNickname(nickname);
                if (!nickValidation.valid) {
                    sendValidationError(socket, nickValidation.error!);
                    return;
                }

                const room = rooms.get(roomId)!;
                const user: User = {
                    socket,
                    anonymousId,
                    nickname,
                    socketId,
                };

                room.add(user);
                userToRoom.set(socketId, roomId);

                const userCount = room.size;

                console.log(`[JOIN_ROOM] User ${nickname} (${anonymousId}) joined Room ${roomId}. Total users: ${userCount}`);

                sendMessage(socket, {
                    type: "ROOM_JOINED",
                    payload: { roomId, userCount },
                });

                broadcastToRoom(
                    roomId,
                    {
                        type: "USER_JOINED",
                        payload: {
                            anonymousId,
                            nickname,
                            userCount,
                        },
                    },
                    socket
                );
            } else if (parsedMessage.type === "SEND_MESSAGE") {
                if (!payload) {
                    sendValidationError(socket, "Payload is required");
                    return;
                }

                const messageText = payload.message;

                if (typeof messageText !== "string") {
                    sendValidationError(socket, "message is required");
                    return;
                }

                const msgValidation = validateMessage(messageText);
                if (!msgValidation.valid) {
                    sendValidationError(socket, msgValidation.error!);
                    return;
                }

                const userRoomId = userToRoom.get(socketId);
                if (!userRoomId) {
                    sendValidationError(socket, "You must join a room before sending messages");
                    return;
                }

                const room = rooms.get(userRoomId)!;
                let senderUser: User | undefined;
                room.forEach((user) => {
                    if (user.socket === socket) {
                        senderUser = user;
                    }
                });

                if (!senderUser) {
                    sendValidationError(socket, "User not found in room");
                    return;
                }

                const timestamp = new Date().toISOString();

                console.log(`[SEND_MESSAGE] ${senderUser.nickname} (${senderUser.anonymousId}) in Room ${userRoomId}: ${messageText.trim()}`);

                broadcastToRoom(userRoomId, {
                    type: "MESSAGE",
                    payload: {
                        anonymousId: senderUser.anonymousId,
                        nickname: senderUser.nickname,
                        message: messageText.trim(),
                        timestamp,
                    },
                });
            } else if (parsedMessage.type === "LEAVE_ROOM") {
                if (payload && typeof payload.roomId !== "undefined" && typeof payload.roomId !== "number") {
                    sendValidationError(socket, "roomId must be a number");
                    return;
                }

                const result = removeUserFromRoom(socketId);

                if (!result) {
                    sendValidationError(socket, "You are not in any room");
                    return;
                }

                const { roomId, userCount, user } = result;

                console.log(`[LEAVE_ROOM] User ${user.nickname} (${user.anonymousId}) left Room ${roomId}. Remaining users: ${userCount}`);

                if (userCount > 0) {
                    broadcastToRoom(roomId, {
                        type: "USER_LEFT",
                        payload: {
                            anonymousId: user.anonymousId,
                            nickname: user.nickname,
                            userCount,
                        },
                    });
                }

                sendMessage(socket, {
                    type: "SUCCESS",
                    payload: { message: "Left room" },
                });
            } else if (parsedMessage.type === "GET_ROOMS") {
                const roomsList: Array<{ roomId: number; userCount: number }> = [];

                rooms.forEach((room, roomId) => {
                    roomsList.push({
                        roomId,
                        userCount: room.size,
                    });
                });

                console.log(`[GET_ROOMS] Returning ${roomsList.length} active rooms`);

                sendMessage(socket, {
                    type: "ROOM_LIST",
                    payload: { rooms: roomsList },
                });
            } else {
                sendMessage(socket, {
                    type: "ERROR",
                    payload: { error: `Handler for ${parsedMessage.type} not yet implemented` },
                });
            }
        } catch (error) {
            console.warn(`[Error] ${socketId} sent invalid JSON: ${formatUnknownError(error)}`);
            sendMessage(socket, {
                type: "ERROR",
                payload: { error: "Invalid JSON format" },
            });
        }
    });

    socket.on("close", () => {
        console.log(`[Disconnect] ${socketId} disconnected`);

        const result = removeUserFromRoom(socketId);

        if (result) {
            const { roomId, userCount, user } = result;

            if (userCount > 0) {
                broadcastToRoom(roomId, {
                    type: "USER_LEFT",
                    payload: {
                        anonymousId: user.anonymousId,
                        nickname: user.nickname,
                        userCount,
                    },
                });
            }
        }
    });

    socket.on("error", (error) => {
        console.error(`[Error] ${socketId} socket error: ${formatUnknownError(error)}`);
    });
});

wss.on("error", (error) => {
    console.error(`[Error] WebSocket server error: ${formatUnknownError(error)}`);
});

process.on("uncaughtException", (error) => {
    console.error(`[Fatal] uncaughtException: ${formatUnknownError(error)}`);
});

process.on("unhandledRejection", (reason) => {
    console.error(`[Fatal] unhandledRejection: ${formatUnknownError(reason)}`);
});

console.log(`
╔════════════════════════════════════════╗
║  WebSocket Chat Server Started        ║
╠════════════════════════════════════════╣
║  Host: ${HOST.padEnd(30)} ║
║  Port: ${String(PORT).padEnd(30)} ║
║  Environment: ${(process.env.NODE_ENV || "development").padEnd(23)} ║
╚════════════════════════════════════════╝
`);
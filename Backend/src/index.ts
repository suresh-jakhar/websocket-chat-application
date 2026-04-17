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

    // Delete room if empty
    if (userCount === 0) {
        rooms.delete(roomId);
        console.log(`[ROOM_CLEANUP] Room ${roomId} deleted (empty)`);
    }

    return { roomId, userCount, user: userToRemove };
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

            // ==================== JOIN_ROOM HANDLER ====================
            else if (parsedMessage.type === "JOIN_ROOM") {
                const { roomId, anonymousId, nickname } = parsedMessage.payload;

                // Validate roomId
                const roomValidation = validateRoomId(roomId);
                if (!roomValidation.valid) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: roomValidation.error! },
                    });
                    return;
                }

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

                // Add user to room
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

                console.log(
                    `[JOIN_ROOM] User ${nickname} (${anonymousId}) joined Room ${roomId}. Total users: ${userCount}`
                );

                // Send confirmation to joining user
                sendMessage(socket, {
                    type: "ROOM_JOINED",
                    payload: { roomId, userCount },
                });

                // Broadcast USER_JOINED to all other users in room
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
            }

            // ==================== SEND_MESSAGE HANDLER ====================
            else if (parsedMessage.type === "SEND_MESSAGE") {
                const { message: messageText } = parsedMessage.payload;

                // Validate message
                const msgValidation = validateMessage(messageText);
                if (!msgValidation.valid) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: msgValidation.error! },
                    });
                    return;
                }

                // Find user's room
                const userRoomId = userToRoom.get(socketId);
                if (!userRoomId) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: "You must join a room before sending messages" },
                    });
                    return;
                }

                // Find sender user object to get anonymousId and nickname
                const room = rooms.get(userRoomId)!;
                let senderUser: User | undefined;
                room.forEach((user) => {
                    if (user.socket === socket) {
                        senderUser = user;
                    }
                });

                if (!senderUser) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: "User not found in room" },
                    });
                    return;
                }

                const timestamp = new Date().toISOString();

                console.log(
                    `[SEND_MESSAGE] ${senderUser.nickname} (${senderUser.anonymousId}) in Room ${userRoomId}: ${messageText.trim()}`
                );

                // Broadcast message to all users in room
                broadcastToRoom(userRoomId, {
                    type: "MESSAGE",
                    payload: {
                        anonymousId: senderUser.anonymousId,
                        nickname: senderUser.nickname,
                        message: messageText.trim(),
                        timestamp,
                    },
                });
            }

            // ==================== LEAVE_ROOM HANDLER ====================
            else if (parsedMessage.type === "LEAVE_ROOM") {
                const result = removeUserFromRoom(socketId);

                if (!result) {
                    sendMessage(socket, {
                        type: "ERROR",
                        payload: { error: "You are not in any room" },
                    });
                    return;
                }

                const { roomId, userCount, user } = result;

                console.log(
                    `[LEAVE_ROOM] User ${user.nickname} (${user.anonymousId}) left Room ${roomId}. Remaining users: ${userCount}`
                );

                // Broadcast USER_LEFT to remaining users
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
            }

            // ==================== GET_ROOMS HANDLER ====================
            else if (parsedMessage.type === "GET_ROOMS") {
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
        
        const result = removeUserFromRoom(socketId);
        
        if (result) {
            const { roomId, userCount, user } = result;
            
            // Broadcast USER_LEFT to remaining users if room still has people
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
        console.error(`[Error] ${socketId} socket error:`, error);
    });
});

console.log("WebSocket server started on port 8080");
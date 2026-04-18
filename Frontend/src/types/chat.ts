export type RoomSummary = {
    roomId: number;
    userCount: number;
};

export type MessagePayload = {
    anonymousId: string;
    nickname: string;
    message: string;
    timestamp: string;
};

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

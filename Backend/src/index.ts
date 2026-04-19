import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { URLSearchParams } from "url";
import { WebSocket } from "ws";

config();

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV ?? "development";
const IS_VERCEL = process.env.VERCEL === "1";
const PIEHOST_CLUSTER_ID = process.env.PIEHOST_CLUSTER_ID ?? "";
const PIEHOST_API_KEY = process.env.PIEHOST_API_KEY ?? "";
const PIEHOST_REGISTRY_ROOM = process.env.PIEHOST_REGISTRY_ROOM ?? "rooms_registry";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "*";
const PROVIDER_USER_ID = "backend-service";

type RoomState = {
    roomId: number;
    userCount: number;
    createdAt: string;
};

type ProviderEvent = {
    event: string;
    data: Record<string, unknown>;
    meta?: string;
};

const rooms = new Map<number, RoomState>();
let roomCounter = 0;
let providerConnected = false;
let registrySocket: WebSocket | null = null;

function isProviderConfigured(): boolean {
    return PIEHOST_CLUSTER_ID.trim().length > 0 && PIEHOST_API_KEY.trim().length > 0;
}

function buildProviderUrl(roomName: string, userId?: string): string {
    const params = new URLSearchParams({
        api_key: PIEHOST_API_KEY,
        notify_self: "1",
        presence: "1",
    });

    if (userId) {
        params.set("user", userId);
    }

    return `wss://${PIEHOST_CLUSTER_ID}.piesocket.com/v3/${encodeURIComponent(roomName)}?${params.toString()}`;
}

function listRooms(): RoomState[] {
    return [...rooms.values()].sort((a, b) => a.roomId - b.roomId);
}

function sendOverSocket(socket: WebSocket, event: ProviderEvent): Promise<void> {
    return new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) {
            reject(new Error("Provider socket is not open"));
            return;
        }

        socket.send(JSON.stringify(event), (error?: Error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function publishToProviderRoom(roomName: string, event: ProviderEvent): Promise<void> {
    if (!isProviderConfigured()) {
        throw new Error("Provider is not configured");
    }

    const url = buildProviderUrl(roomName, PROVIDER_USER_ID);

    await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url);

        ws.on("open", () => {
            void sendOverSocket(ws, event)
                .then(() => {
                    ws.close();
                    resolve();
                })
                .catch((error) => {
                    ws.close();
                    reject(error);
                });
        });

        ws.on("error", (error) => {
            reject(error);
        });
    });
}

function connectRegistrySocket() {
    if (!isProviderConfigured()) {
        providerConnected = false;
        return;
    }

    if (registrySocket && (registrySocket.readyState === WebSocket.OPEN || registrySocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const url = buildProviderUrl(PIEHOST_REGISTRY_ROOM, PROVIDER_USER_ID);
    registrySocket = new WebSocket(url);

    registrySocket.on("open", () => {
        providerConnected = true;
        console.log(`[Provider] Connected to registry room '${PIEHOST_REGISTRY_ROOM}'`);
    });

    registrySocket.on("close", () => {
        providerConnected = false;
        registrySocket = null;

        if (NODE_ENV !== "test") {
            setTimeout(() => connectRegistrySocket(), 1500);
        }
    });

    registrySocket.on("error", (error) => {
        providerConnected = false;
        console.error(`[Provider] Registry socket error: ${error.message}`);
    });
}

async function publishRegistryEvent(event: ProviderEvent): Promise<void> {
    if (!isProviderConfigured()) {
        return;
    }

    if (registrySocket && registrySocket.readyState === WebSocket.OPEN) {
        await sendOverSocket(registrySocket, event);
        return;
    }

    await publishToProviderRoom(PIEHOST_REGISTRY_ROOM, event);
}

function parseAllowedOrigins(value: string): string[] | "*" {
    const trimmed = value.trim();
    if (trimmed === "*") {
        return "*";
    }

    const entries = trimmed
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    return entries.length === 0 ? "*" : entries;
}

function matchesOriginRule(origin: string, rule: string): boolean {
    if (rule === origin) {
        return true;
    }

    if (rule.startsWith("*.")) {
        const suffix = rule.slice(1);
        return origin.endsWith(suffix);
    }

    return false;
}

function isAllowedOrigin(origin: string | undefined, allowedOrigins: string[] | "*"): boolean {
    if (!origin) {
        return true;
    }

    if (allowedOrigins === "*") {
        return true;
    }

    return allowedOrigins.some((rule) => matchesOriginRule(origin, rule));
}

const app = express();
const allowedOrigins = parseAllowedOrigins(FRONTEND_ORIGIN);
const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
            callback(null, true);
            return;
        }

        callback(new Error(`CORS blocked for origin: ${origin ?? "unknown"}`));
    },
    credentials: false,
};

app.use(express.json({ limit: "512kb" }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.get("/health", (_, res) => {
    res.json({
        ok: true,
        service: "chat-backend-api",
        environment: NODE_ENV,
        provider: {
            configured: isProviderConfigured(),
            connected: providerConnected,
            clusterId: PIEHOST_CLUSTER_ID || null,
            registryRoom: PIEHOST_REGISTRY_ROOM,
        },
        cors: {
            frontendOriginConfig: FRONTEND_ORIGIN,
            allowedOrigins,
        },
    });
});

app.get("/config/public", (_, res) => {
    res.json({
        clusterId: PIEHOST_CLUSTER_ID || null,
        registryRoom: PIEHOST_REGISTRY_ROOM,
    });
});

app.get("/rooms", (_, res) => {
    res.json({
        rooms: listRooms().map((room) => ({ roomId: room.roomId, userCount: room.userCount })),
    });
});

app.post("/rooms", async (req, res) => {
    const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim() : "";
    const anonymousId = typeof req.body?.anonymousId === "string" ? req.body.anonymousId.trim() : "";

    if (!nickname || nickname.length > 30) {
        res.status(400).json({ error: "Valid nickname is required (max 30 chars)." });
        return;
    }

    if (!anonymousId) {
        res.status(400).json({ error: "anonymousId is required." });
        return;
    }

    roomCounter += 1;
    const roomId = roomCounter;

    rooms.set(roomId, {
        roomId,
        userCount: 0,
        createdAt: new Date().toISOString(),
    });

    try {
        await publishRegistryEvent({
            event: "room_created",
            data: { roomId, nickname, anonymousId },
        });
    } catch (error) {
        console.warn(`[Provider] Failed to publish room_created event: ${String(error)}`);
    }

    res.status(201).json({ roomId });
});

app.post("/rooms/:roomId/count", async (req, res) => {
    const roomId = Number(req.params.roomId);
    const userCount = Number(req.body?.userCount);

    if (!Number.isFinite(roomId) || roomId <= 0) {
        res.status(400).json({ error: "roomId must be a positive number." });
        return;
    }

    if (!Number.isFinite(userCount) || userCount < 0) {
        res.status(400).json({ error: "userCount must be a non-negative number." });
        return;
    }

    const existing = rooms.get(roomId);
    if (!existing) {
        rooms.set(roomId, {
            roomId,
            userCount,
            createdAt: new Date().toISOString(),
        });
    } else {
        existing.userCount = userCount;
        if (userCount === 0) {
            rooms.delete(roomId);
        }
    }

    try {
        await publishRegistryEvent({
            event: "room_count_update",
            data: { roomId, userCount },
        });
    } catch (error) {
        console.warn(`[Provider] Failed to publish room_count_update event: ${String(error)}`);
    }

    res.json({ success: true });
});

app.post("/provider/publish", async (req, res) => {
    const roomName = typeof req.body?.roomName === "string" ? req.body.roomName.trim() : "";
    const eventName = typeof req.body?.event === "string" ? req.body.event.trim() : "";
    const data = req.body?.data;

    if (!roomName) {
        res.status(400).json({ error: "roomName is required." });
        return;
    }

    if (!eventName) {
        res.status(400).json({ error: "event is required." });
        return;
    }

    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        res.status(400).json({ error: "data must be a JSON object." });
        return;
    }

    try {
        await publishToProviderRoom(roomName, {
            event: eventName,
            data: data as Record<string, unknown>,
        });

        res.json({ success: true });
    } catch (error) {
        res.status(502).json({ error: `Provider publish failed: ${String(error)}` });
    }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: `Internal server error: ${message}` });
});

if (isProviderConfigured() && !IS_VERCEL) {
    connectRegistrySocket();
} else {
    if (!isProviderConfigured()) {
        console.warn("[Provider] Missing PIEHOST_CLUSTER_ID or PIEHOST_API_KEY. Provider integration disabled.");
    }
}

if (!IS_VERCEL) {
    app.listen(PORT, HOST, () => {
        console.log(`
+----------------------------------------+
�  Chat Backend API Started             �
�----------------------------------------�
�  Host: ${HOST.padEnd(30)} �
�  Port: ${String(PORT).padEnd(30)} �
�  Environment: ${NODE_ENV.padEnd(23)} �
�  Provider configured: ${String(isProviderConfigured()).padEnd(13)} �
+----------------------------------------+
`);
    });
}

export default app;

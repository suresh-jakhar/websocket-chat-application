import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
    console.log("Connected to server");

    // Test CREATE_ROOM
    const createRoomMsg = {
        type: "CREATE_ROOM",
        payload: {
            anonymousId: "user_123",
            nickname: "Alice",
        },
    };

    console.log("Sending CREATE_ROOM:", createRoomMsg);
    ws.send(JSON.stringify(createRoomMsg));
});

ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());
    console.log("Received:", msg);

    if (msg.type === "ROOM_CREATED") {
        console.log(`✅ Room created successfully: Room ${msg.payload.roomId}`);
        ws.close();
    }
});

ws.on("error", (err) => {
    console.error("Error:", err);
});

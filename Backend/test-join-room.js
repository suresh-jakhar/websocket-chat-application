import WebSocket from "ws";

async function testJoinRoom() {
    // Test 1: Create a room first
    console.log("\n=== Test 1: Create Room ===");
    let createdRoomId = 0;
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(
                JSON.stringify({
                    type: "CREATE_ROOM",
                    payload: { anonymousId: "creator_1", nickname: "Creator" },
                })
            );
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_CREATED") {
                createdRoomId = msg.payload.roomId;
                console.log("✅ Room created:", createdRoomId);
                ws.close();
                resolve();
            }
        });
    });

    // Test 2: Join the room
    console.log("\n=== Test 2: Join Room ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(
                JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: {
                        roomId: createdRoomId,
                        anonymousId: "user_2",
                        nickname: "Alice",
                    },
                })
            );
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("✅ Joined room:", msg.payload);
            }
            if (msg.type === "USER_JOINED") {
                console.log("✅ Broadcast received (USER_JOINED):", msg.payload);
                ws.close();
                resolve();
            }
        });
    });

    // Test 3: Join non-existent room
    console.log("\n=== Test 3: Join Non-Existent Room ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(
                JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: {
                        roomId: 999,
                        anonymousId: "user_3",
                        nickname: "Bob",
                    },
                })
            );
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws.close();
            resolve();
        });
    });

    // Test 4: Join with invalid nickname
    console.log("\n=== Test 4: Join with Empty Nickname ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(
                JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: {
                        roomId: createdRoomId,
                        anonymousId: "user_4",
                        nickname: "",
                    },
                })
            );
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws.close();
            resolve();
        });
    });

    // Test 5: Multiple users in same room
    console.log("\n=== Test 5: Multiple Users Join Same Room ===");
    const ws1 = new WebSocket("ws://localhost:8080");
    const ws2 = new WebSocket("ws://localhost:8080");

    await new Promise((resolve) => {
        let messagesReceived = 0;

        const handleMessage = (ws, label, data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log(`[${label}] Joined:`, msg.payload);
            } else if (msg.type === "USER_JOINED") {
                console.log(`[${label}] Saw USER_JOINED:`, msg.payload);
                messagesReceived++;
                if (messagesReceived === 2) {
                    ws1.close();
                    ws2.close();
                    resolve();
                }
            }
        };

        ws1.on("open", () => {
            ws1.send(
                JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: {
                        roomId: createdRoomId,
                        anonymousId: "user_5",
                        nickname: "User5",
                    },
                })
            );
        });

        ws1.on("message", (data) => {
            handleMessage(ws1, "WS1", data);
        });

        ws2.on("open", () => {
            setTimeout(() => {
                ws2.send(
                    JSON.stringify({
                        type: "JOIN_ROOM",
                        payload: {
                            roomId: createdRoomId,
                            anonymousId: "user_6",
                            nickname: "User6",
                        },
                    })
                );
            }, 100);
        });

        ws2.on("message", (data) => {
            handleMessage(ws2, "WS2", data);
        });
    });

    console.log("\n✅ All JOIN_ROOM tests completed");
}

testJoinRoom();

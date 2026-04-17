import WebSocket from "ws";

async function testJoinRoom() {
    console.log("\n=== Test 1: Create Room ===");
    let roomId = 0;
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "CREATE_ROOM",
                payload: { anonymousId: "creator_1", nickname: "Creator" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_CREATED") {
                roomId = msg.payload.roomId;
                console.log("✅ Room created:", roomId);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 2: First user joins (empty room) ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "user_1", nickname: "Alice" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("✅ Alice joined room:", msg.payload);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 3: Join with invalid roomId ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: 999, anonymousId: "user_2", nickname: "Bob" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 4: Two users join same room (should see broadcasts) ===");
    const user1Joined = new Promise((resolve) => {
        const ws1 = new WebSocket("ws://localhost:8080");
        ws1.on("open", () => {
            ws1.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "user_3", nickname: "User3" },
            }));
        });
        ws1.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[User3] Joined room");
            } else if (msg.type === "USER_JOINED") {
                console.log("[User3] Saw USER_JOINED broadcast:", msg.payload.nickname);
            }
            setTimeout(() => {
                ws1.close();
                resolve();
            }, 500);
        });
    });

    const user2Joined = new Promise((resolve) => {
        setTimeout(() => {
            const ws2 = new WebSocket("ws://localhost:8080");
            ws2.on("open", () => {
                ws2.send(JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: { roomId, anonymousId: "user_4", nickname: "User4" },
                }));
            });
            ws2.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "ROOM_JOINED") {
                    console.log("[User4] Joined room");
                } else if (msg.type === "USER_JOINED") {
                    console.log("[User4] Saw USER_JOINED broadcast:", msg.payload.nickname);
                }
                setTimeout(() => {
                    ws2.close();
                    resolve();
                }, 500);
            });
        }, 100);
    });

    await Promise.all([user1Joined, user2Joined]);

    console.log("\n✅ All JOIN_ROOM tests completed");
}

testJoinRoom().catch(console.error);

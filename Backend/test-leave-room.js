import WebSocket from "ws";

async function testLeaveRoom() {
    console.log("\n=== Test 1: Create Room ===");
    let roomId = 0;
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "CREATE_ROOM",
                payload: { anonymousId: "creator", nickname: "Creator" },
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

    console.log("\n=== Test 2: Leave room when not in any room (should error) ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "LEAVE_ROOM",
                payload: {},
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 3: User leaves room with other users (should broadcast USER_LEFT) ===");
    const user1Promise = new Promise((resolve) => {
        const ws1 = new WebSocket("ws://localhost:8080");
        ws1.on("open", () => {
            ws1.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "alice_id", nickname: "Alice" },
            }));
        });
        ws1.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[Alice] Joined room");
            } else if (msg.type === "USER_JOINED") {
                console.log("[Alice] Saw USER_JOINED:", msg.payload.nickname);
            } else if (msg.type === "USER_LEFT") {
                console.log("[Alice] Saw USER_LEFT broadcast:", msg.payload);
                ws1.close();
                resolve();
            }
        });
    });

    const user2Promise = new Promise((resolve) => {
        setTimeout(() => {
            const ws2 = new WebSocket("ws://localhost:8080");
            ws2.on("open", () => {
                ws2.send(JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: { roomId, anonymousId: "bob_id", nickname: "Bob" },
                }));
            });
            ws2.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "ROOM_JOINED") {
                    console.log("[Bob] Joined room");
                    setTimeout(() => {
                        console.log("[Bob] Sending LEAVE_ROOM...");
                        ws2.send(JSON.stringify({
                            type: "LEAVE_ROOM",
                            payload: {},
                        }));
                    }, 200);
                } else if (msg.type === "SUCCESS") {
                    console.log("[Bob] Leave SUCCESS");
                    ws2.close();
                    resolve();
                }
            });
        }, 100);
    });

    await Promise.all([user1Promise, user2Promise]);

    console.log("\n=== Test 4: Room deletion when last user leaves ===");
    let testRoom4Id = 0;
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "CREATE_ROOM",
                payload: { anonymousId: "creator", nickname: "Creator" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_CREATED") {
                testRoom4Id = msg.payload.roomId;
                console.log("[Test4] New room created:", testRoom4Id);
                ws.close();
                resolve();
            }
        });
    });

    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: testRoom4Id, anonymousId: "charlie_id", nickname: "Charlie" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[Charlie] Joined room (only user)");
                setTimeout(() => {
                    console.log("[Charlie] Sending LEAVE_ROOM...");
                    ws.send(JSON.stringify({
                        type: "LEAVE_ROOM",
                        payload: {},
                    }));
                }, 200);
            } else if (msg.type === "SUCCESS") {
                console.log("[Charlie] Room should be deleted now (empty)");
                ws.close();
                resolve();
            } else if (msg.type === "ERROR") {
                console.log("[Charlie] Error:", msg.payload.error);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 5: Disconnect cleanup (socket close) ===");
    let testRoomId = 0;
    // Create room
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "CREATE_ROOM",
                payload: { anonymousId: "creator", nickname: "Creator" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_CREATED") {
                testRoomId = msg.payload.roomId;
                console.log("[Test5] Room created:", testRoomId);
                ws.close();
                resolve();
            }
        });
    });

    // User 1 joins
    const disconnect1 = new Promise((resolve) => {
        const ws1 = new WebSocket("ws://localhost:8080");
        ws1.on("open", () => {
            ws1.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: testRoomId, anonymousId: "user1", nickname: "User1" },
            }));
        });
        ws1.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[User1] Joined, now closing connection (disconnect)...");
                ws1.close();
                setTimeout(resolve, 200);
            }
        });
    });

    // User 2 joins and waits for USER_LEFT
    const disconnect2 = new Promise((resolve) => {
        setTimeout(() => {
            const ws2 = new WebSocket("ws://localhost:8080");
            ws2.on("open", () => {
                ws2.send(JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: { roomId: testRoomId, anonymousId: "user2", nickname: "User2" },
                }));
            });
            ws2.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "ROOM_JOINED") {
                    console.log("[User2] Joined room");
                } else if (msg.type === "USER_LEFT") {
                    console.log("[User2] Saw USER_LEFT from disconnect:", msg.payload);
                    ws2.close();
                    resolve();
                }
            });
        }, 100);
    });

    await Promise.all([disconnect1, disconnect2]);

    console.log("\n✅ All LEAVE_ROOM tests completed");
}

testLeaveRoom().catch(console.error);

import WebSocket from "ws";

async function testGetRooms() {
    console.log("\n=== Test 1: GET_ROOMS when no rooms exist ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "GET_ROOMS",
                payload: {},
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_LIST") {
                console.log("Response:", msg.payload);
                console.log(`✅ Got ${msg.payload.rooms.length} rooms`);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 2: Create rooms and check GET_ROOMS ===");
    const roomIds = [];
    
    // Create 3 rooms
    for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => {
            const ws = new WebSocket("ws://localhost:8080");
            ws.on("open", () => {
                ws.send(JSON.stringify({
                    type: "CREATE_ROOM",
                    payload: { anonymousId: `creator_${i}`, nickname: `Creator${i}` },
                }));
            });
            ws.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "ROOM_CREATED") {
                    roomIds.push(msg.payload.roomId);
                    console.log(`✅ Room created: ${msg.payload.roomId}`);
                    ws.close();
                    resolve();
                }
            });
        });
    }

    // Get room list
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "GET_ROOMS",
                payload: {},
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_LIST") {
                console.log("Rooms list:", msg.payload.rooms);
                console.log(`✅ Got ${msg.payload.rooms.length} rooms`);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 3: GET_ROOMS with users in rooms ===");
    const room1Id = roomIds[0];
    
    // User joins room 1
    const user1Joins = new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: room1Id, anonymousId: "user1", nickname: "User1" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[User1] Joined room 1");
                ws.close();
                resolve();
            }
        });
    });

    await user1Joins;

    // User 2 joins room 1
    const user2Joins = new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: room1Id, anonymousId: "user2", nickname: "User2" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("[User2] Joined room 1");
                ws.close();
                resolve();
            }
        });
    });

    await user2Joins;

    // Get room list - should show updated user counts
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            console.log("Fetching room list...");
            ws.send(JSON.stringify({
                type: "GET_ROOMS",
                payload: {},
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_LIST") {
                console.log("Rooms with users:");
                msg.payload.rooms.forEach((room) => {
                    console.log(`  Room ${room.roomId}: ${room.userCount} user(s)`);
                });
                console.log(`✅ Total rooms: ${msg.payload.rooms.length}`);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 4: Poll GET_ROOMS multiple times (simulates frontend polling) ===");
    // Create a new room
    let pollTestRoomId = 0;
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "CREATE_ROOM",
                payload: { anonymousId: "poll_creator", nickname: "PollCreator" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_CREATED") {
                pollTestRoomId = msg.payload.roomId;
                console.log(`✅ Poll test room created: ${pollTestRoomId}`);
                ws.close();
                resolve();
            }
        });
    });

    // Poll 3 times
    for (let poll = 1; poll <= 3; poll++) {
        await new Promise((resolve) => {
            const ws = new WebSocket("ws://localhost:8080");
            ws.on("open", () => {
                ws.send(JSON.stringify({
                    type: "GET_ROOMS",
                    payload: {},
                }));
            });
            ws.on("message", (data) => {
                const msg = JSON.parse(data.toString());
                if (msg.type === "ROOM_LIST") {
                    console.log(`[Poll ${poll}] Got ${msg.payload.rooms.length} rooms`);
                    ws.close();
                    resolve();
                }
            });
        });
    }

    console.log("\n✅ All GET_ROOMS tests completed");
}

testGetRooms().catch(console.error);

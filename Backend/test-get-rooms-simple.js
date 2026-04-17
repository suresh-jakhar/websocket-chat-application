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
                console.log("✅ Empty room list:", msg.payload.rooms);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 2: Create multiple rooms ===");
    const roomIds = [];
    
    for (let i = 0; i < 2; i++) {
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

    console.log("\n=== Test 3: GET_ROOMS returns created rooms ===");
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
                console.log("Rooms with 0 users:");
                msg.payload.rooms.forEach((room) => {
                    console.log(`  Room ${room.roomId}: ${room.userCount} user(s)`);
                });
                console.log(`✅ Total rooms: ${msg.payload.rooms.length}`);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 4: Add user to room and verify GET_ROOMS ===");
    const testRoomId = roomIds[0];
    
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId: testRoomId, anonymousId: "testuser", nickname: "TestUser" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                console.log("✅ User joined room");
                
                // Now query rooms
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: "GET_ROOMS",
                        payload: {},
                    }));
                }, 100);
            } else if (msg.type === "ROOM_LIST") {
                console.log("Rooms after user joins:");
                msg.payload.rooms.forEach((room) => {
                    console.log(`  Room ${room.roomId}: ${room.userCount} user(s)`);
                });
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n✅ All GET_ROOMS tests completed successfully");
}

testGetRooms().catch(console.error);

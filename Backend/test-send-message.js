import WebSocket from "ws";

async function testSendMessage() {
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

    console.log("\n=== Test 2: Send message before joining (should error) ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "SEND_MESSAGE",
                payload: { message: "Hello" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 3: Send empty message ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "user1", nickname: "User1" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                ws.send(JSON.stringify({
                    type: "SEND_MESSAGE",
                    payload: { message: "" },
                }));
            } else if (msg.type === "ERROR") {
                console.log("Response:", msg.payload.error);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 4: Send message with only whitespace ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "user2", nickname: "User2" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                ws.send(JSON.stringify({
                    type: "SEND_MESSAGE",
                    payload: { message: "   \n\t   " },
                }));
            } else if (msg.type === "ERROR") {
                console.log("Response:", msg.payload.error);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 5: Send message too long (>500 chars) ===");
    await new Promise((resolve) => {
        const ws = new WebSocket("ws://localhost:8080");
        ws.on("open", () => {
            ws.send(JSON.stringify({
                type: "JOIN_ROOM",
                payload: { roomId, anonymousId: "user3", nickname: "User3" },
            }));
        });
        ws.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ROOM_JOINED") {
                ws.send(JSON.stringify({
                    type: "SEND_MESSAGE",
                    payload: { message: "A".repeat(501) },
                }));
            } else if (msg.type === "ERROR") {
                console.log("Response:", msg.payload.error);
                ws.close();
                resolve();
            }
        });
    });

    console.log("\n=== Test 6: Two users send and receive messages ===");
    const user1Promise = new Promise((resolve) => {
        const ws1 = new WebSocket("ws://localhost:8080");
        const messages = [];
        
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
                setTimeout(() => {
                    ws1.send(JSON.stringify({
                        type: "SEND_MESSAGE",
                        payload: { message: "Hi from Alice!" },
                    }));
                }, 100);
            } else if (msg.type === "MESSAGE") {
                console.log("[Alice] Received:", msg.payload);
                messages.push(msg.payload);
                if (messages.length === 2) {
                    ws1.close();
                    resolve();
                }
            } else if (msg.type === "USER_JOINED") {
                console.log("[Alice] Saw USER_JOINED:", msg.payload.nickname);
            }
        });
    });

    const user2Promise = new Promise((resolve) => {
        setTimeout(() => {
            const ws2 = new WebSocket("ws://localhost:8080");
            const messages = [];
            
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
                        ws2.send(JSON.stringify({
                            type: "SEND_MESSAGE",
                            payload: { message: "Hi from Bob!" },
                        }));
                    }, 100);
                } else if (msg.type === "MESSAGE") {
                    console.log("[Bob] Received:", msg.payload);
                    messages.push(msg.payload);
                    if (messages.length === 2) {
                        ws2.close();
                        resolve();
                    }
                } else if (msg.type === "USER_JOINED") {
                    console.log("[Bob] Saw USER_JOINED:", msg.payload.nickname);
                }
            });
        }, 50);
    });

    await Promise.all([user1Promise, user2Promise]);

    console.log("\n✅ All SEND_MESSAGE tests completed");
}

testSendMessage().catch(console.error);

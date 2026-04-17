import WebSocket from "ws";

function connect() {
    return new WebSocket("ws://localhost:8080");
}

async function sendAndWait(ws, message) {
    return new Promise((resolve) => {
        ws.once("message", (data) => {
            resolve(JSON.parse(data.toString()));
        });
        ws.send(message);
    });
}

async function testValidationHardening() {
    console.log("\n=== Test 1: Invalid JSON ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(ws, "not json");
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 2: Missing message type ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(ws, JSON.stringify({ payload: {} }));
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 3: CREATE_ROOM without payload ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(ws, JSON.stringify({ type: "CREATE_ROOM" }));
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 4: JOIN_ROOM with roomId as string ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(
                ws,
                JSON.stringify({
                    type: "JOIN_ROOM",
                    payload: { roomId: "1", anonymousId: "u1", nickname: "User1" },
                })
            );
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 5: SEND_MESSAGE without payload ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(ws, JSON.stringify({ type: "SEND_MESSAGE" }));
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n=== Test 6: LEAVE_ROOM with invalid roomId type ===");
    await new Promise((resolve) => {
        const ws = connect();
        ws.on("open", async () => {
            const response = await sendAndWait(
                ws,
                JSON.stringify({ type: "LEAVE_ROOM", payload: { roomId: "abc" } })
            );
            console.log("Response:", response);
            ws.close();
            resolve();
        });
    });

    console.log("\n✅ Validation hardening tests completed");
}

testValidationHardening().catch(console.error);

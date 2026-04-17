import WebSocket from "ws";

async function testValidation() {
    // Test 1: Empty nickname
    console.log("\n=== Test 1: Empty nickname ===");
    const ws1 = new WebSocket("ws://localhost:8080");
    await new Promise((resolve) => {
        ws1.on("open", () => {
            ws1.send(
                JSON.stringify({
                    type: "CREATE_ROOM",
                    payload: { anonymousId: "user_123", nickname: "" },
                })
            );
        });
        ws1.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws1.close();
            resolve(null);
        });
    });

    // Test 2: Missing anonymousId
    console.log("\n=== Test 2: Missing anonymousId ===");
    const ws2 = new WebSocket("ws://localhost:8080");
    await new Promise((resolve) => {
        ws2.on("open", () => {
            ws2.send(
                JSON.stringify({
                    type: "CREATE_ROOM",
                    payload: { anonymousId: "", nickname: "Bob" },
                })
            );
        });
        ws2.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws2.close();
            resolve(null);
        });
    });

    // Test 3: Nickname too long
    console.log("\n=== Test 3: Nickname too long (>30 chars) ===");
    const ws3 = new WebSocket("ws://localhost:8080");
    await new Promise((resolve) => {
        ws3.on("open", () => {
            ws3.send(
                JSON.stringify({
                    type: "CREATE_ROOM",
                    payload: {
                        anonymousId: "user_123",
                        nickname: "A".repeat(50),
                    },
                })
            );
        });
        ws3.on("message", (data) => {
            const msg = JSON.parse(data.toString());
            console.log("Response:", msg);
            ws3.close();
            resolve(null);
        });
    });

    console.log("\n✅ All validation tests completed");
}

testValidation();

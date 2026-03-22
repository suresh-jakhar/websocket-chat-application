import { WebSocketServer, WebSocket } from "ws";

// Create WebSocket server
const wss = new WebSocketServer({ port: 8080 });


wss.on("connection" , function(socket){
    console.log("user connected")
    setInterval(()=>{
        socket.send("hello");
    },1000)

    socket.on("message", (e) =>{
        console.log(e.toString());
    })
})



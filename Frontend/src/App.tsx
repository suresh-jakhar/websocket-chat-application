import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {

  const [socket, setSocket] = useState(null);
  const inputRef = useRef();

  function sendMessage(){
    if (!socket) {
      alert("WebSocket not connected yet");
      return;
    }

    const message = inputRef.current.value;
    socket.send(message);
  }

  useEffect(()=>{
    const ws = new WebSocket("ws://localhost:8080");

    ws.onopen = () => {
      console.log("Connected to server");
    };

    ws.onmessage = (ev) => {
      alert(ev.data);
    };

    ws.onerror = (err) => {
      console.error(err);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  },[])

  return(
    <div>
      <input ref={inputRef} type="text" placeholder='Message..' />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}

export default App
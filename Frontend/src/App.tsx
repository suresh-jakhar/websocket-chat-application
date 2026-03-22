import './App.css'

function App() {

  function sendMessage(){

  }

  return(
    <div>
      <input type="text" placeholder='Message..' ></input>
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}

export default App

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import incomingSound from "./audio/incoming_text_sound.wav";
import joinLeaveSound from "./audio/join-leave-room-sound.wav";
import outgoingSound from "./audio/outgoing_text_sound.wav";

type RoomSummary = {
	roomId: number;
	userCount: number;
};

type MessagePayload = {
	anonymousId: string;
	nickname: string;
	message: string;
	timestamp: string;
};

type IncomingServerMessage = {
	type: string;
	payload?: Record<string, unknown>;
};

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";

function generateAnonymousId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return `anon_${crypto.randomUUID().slice(0, 8)}`;
	}
	return `anon_${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(timestamp: string) {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return "--:--";
	}
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function App() {
	const socketRef = useRef<WebSocket | null>(null);
	const roomsPollRef = useRef<number | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
	const [nicknameInput, setNicknameInput] = useState("");
	const [nickname, setNickname] = useState("");
	const [rooms, setRooms] = useState<RoomSummary[]>([]);
	const [currentRoomId, setCurrentRoomId] = useState<number | null>(null);
	const [roomUserCount, setRoomUserCount] = useState(0);
	const [messageInput, setMessageInput] = useState("");
	const [messages, setMessages] = useState<MessagePayload[]>([]);
	const [systemFeed, setSystemFeed] = useState<string[]>([]);
	const [errorText, setErrorText] = useState("");
	const anonymousId = useMemo(() => generateAnonymousId(), []);

	const sounds = useMemo(
		() => ({
			incoming: new Audio(incomingSound),
			outgoing: new Audio(outgoingSound),
			joinLeave: new Audio(joinLeaveSound),
		}),
		[]
	);

	const playSound = (kind: "incoming" | "outgoing" | "joinLeave") => {
		const audio = sounds[kind];
		audio.currentTime = 0;
		void audio.play().catch(() => {
			return;
		});
	};

	const sendSocketMessage = (message: object) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			setErrorText("Socket is not connected right now.");
			return;
		}
		socket.send(JSON.stringify(message));
	};

	const requestRooms = () => {
		sendSocketMessage({ type: "GET_ROOMS", payload: {} });
	};

	const connectSocket = () => {
		setConnectionStatus("connecting");
		const socket = new WebSocket(WS_URL);
		socketRef.current = socket;

		socket.onopen = () => {
			setConnectionStatus("connected");
			setErrorText("");
			requestRooms();
		};

		socket.onmessage = (event) => {
			let parsed: IncomingServerMessage;
			try {
				parsed = JSON.parse(event.data.toString()) as IncomingServerMessage;
			} catch {
				return;
			}

			const payload = parsed.payload ?? {};

			if (parsed.type === "ROOM_LIST") {
				const roomList = (payload.rooms as RoomSummary[] | undefined) ?? [];
				const safeRooms = roomList
					.filter((room) => Number.isFinite(room.roomId) && Number.isFinite(room.userCount))
					.sort((a, b) => a.roomId - b.roomId);
				setRooms(safeRooms);
				return;
			}

			if (parsed.type === "ROOM_CREATED") {
				const roomId = payload.roomId as number | undefined;
				if (typeof roomId === "number") {
					sendSocketMessage({
						type: "JOIN_ROOM",
						payload: {
							roomId,
							anonymousId,
							nickname,
						},
					});
				}
				return;
			}

			if (parsed.type === "ROOM_JOINED") {
				const roomId = payload.roomId as number | undefined;
				const userCount = payload.userCount as number | undefined;
				if (typeof roomId === "number") {
					setCurrentRoomId(roomId);
					setRoomUserCount(typeof userCount === "number" ? userCount : 0);
					setMessages([]);
					setSystemFeed([`You joined Room ${roomId}.`]);
					playSound("joinLeave");
					requestRooms();
				}
				return;
			}

			if (parsed.type === "USER_JOINED") {
				const joinedBy = payload.nickname as string | undefined;
				const userCount = payload.userCount as number | undefined;
				if (typeof userCount === "number") {
					setRoomUserCount(userCount);
				}
				if (joinedBy) {
					setSystemFeed((prev) => [...prev.slice(-14), `${joinedBy} joined the room.`]);
					playSound("joinLeave");
				}
				requestRooms();
				return;
			}

			if (parsed.type === "USER_LEFT") {
				const leftBy = payload.nickname as string | undefined;
				const userCount = payload.userCount as number | undefined;
				if (typeof userCount === "number") {
					setRoomUserCount(userCount);
				}
				if (leftBy) {
					setSystemFeed((prev) => [...prev.slice(-14), `${leftBy} left the room.`]);
				}
				playSound("joinLeave");
				requestRooms();
				return;
			}

			if (parsed.type === "MESSAGE") {
				const chatPayload = payload as Partial<MessagePayload>;
				if (!chatPayload.message || !chatPayload.nickname || !chatPayload.anonymousId || !chatPayload.timestamp) {
					return;
				}

				const normalized: MessagePayload = {
					anonymousId: chatPayload.anonymousId,
					nickname: chatPayload.nickname,
					message: chatPayload.message,
					timestamp: chatPayload.timestamp,
				};

				setMessages((prev) => [...prev, normalized]);

				if (normalized.anonymousId === anonymousId) {
					return;
				}
				playSound("incoming");
				return;
			}

			if (parsed.type === "SUCCESS") {
				const message = payload.message as string | undefined;
				if (message === "Left room") {
					setCurrentRoomId(null);
					setRoomUserCount(0);
					setMessages([]);
					setSystemFeed([]);
					playSound("joinLeave");
					requestRooms();
				}
				return;
			}

			if (parsed.type === "ERROR") {
				const error = payload.error as string | undefined;
				setErrorText(error ?? "Unknown socket error");
			}
		};

		socket.onclose = () => {
			setConnectionStatus("disconnected");
		};

		socket.onerror = () => {
			setConnectionStatus("disconnected");
		};
	};

	useEffect(() => {
		connectSocket();

		roomsPollRef.current = window.setInterval(() => {
			if (socketRef.current?.readyState === WebSocket.OPEN) {
				requestRooms();
			}
		}, 3000);

		return () => {
			if (roomsPollRef.current) {
				window.clearInterval(roomsPollRef.current);
			}
			socketRef.current?.close();
		};
	}, []);

	const saveNickname = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = nicknameInput.trim();
		if (!trimmed) {
			setErrorText("Nickname is mandatory.");
			return;
		}
		if (trimmed.length > 30) {
			setErrorText("Nickname must be 30 characters or less.");
			return;
		}
		setNickname(trimmed);
		setErrorText("");
		requestRooms();
	};

	const createRoom = () => {
		if (!nickname) {
			setErrorText("Set your nickname first.");
			return;
		}
		sendSocketMessage({
			type: "CREATE_ROOM",
			payload: {
				anonymousId,
				nickname,
			},
		});
	};

	const joinRoom = (roomId: number) => {
		if (!nickname) {
			setErrorText("Set your nickname first.");
			return;
		}
		sendSocketMessage({
			type: "JOIN_ROOM",
			payload: {
				roomId,
				anonymousId,
				nickname,
			},
		});
	};

	const leaveRoom = () => {
		sendSocketMessage({
			type: "LEAVE_ROOM",
			payload: {
				roomId: currentRoomId,
			},
		});
	};

	const sendMessageToRoom = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageInput.trim();
		if (!trimmed) {
			return;
		}
		playSound("outgoing");
		sendSocketMessage({
			type: "SEND_MESSAGE",
			payload: {
				message: trimmed,
			},
		});
		setMessageInput("");
	};

	return (
		<main className="app-root">
			<div className="bg-shape shape-1" />
			<div className="bg-shape shape-2" />
			<div className="bg-shape shape-3" />

			<section className="status-strip">
				<strong>Server:</strong>
				<span className={`status-pill ${connectionStatus}`}>{connectionStatus}</span>
				<span className="env-pill">{WS_URL}</span>
				<span className="env-pill">ID: {anonymousId}</span>
			</section>

			{!nickname ? (
				<section className="panel hero-panel">
					<h1>Neo Brutal Rooms</h1>
					<p>
						Loud colors, thick borders, live chat. Pick a mandatory nickname and jump into numeric rooms instantly.
					</p>

					<form onSubmit={saveNickname} className="nickname-form">
						<input
							value={nicknameInput}
							onChange={(event) => setNicknameInput(event.target.value)}
							placeholder="mandatory nickname"
							maxLength={30}
						/>
						<button type="submit">Start Chatting</button>
					</form>
				</section>
			) : currentRoomId === null ? (
				<section className="layout-grid">
					<article className="panel hero-panel">
						<h1>Welcome, {nickname}</h1>
						<p>Create a room or join any active room below. Room IDs are numeric and fully ephemeral.</p>
						<button onClick={createRoom} className="action-btn action-cyan">Create Room</button>
					</article>

					<article className="panel room-list-panel">
						<div className="panel-top">
							<h2>Active Rooms</h2>
							<button onClick={requestRooms} className="action-btn action-pink">Refresh</button>
						</div>

						<div className="room-list">
							{rooms.length === 0 ? (
								<p className="muted">No active rooms yet. Create one and share the ID.</p>
							) : (
								rooms.map((room) => (
									<div key={room.roomId} className="room-card">
										<div>
											<h3>Room {room.roomId}</h3>
											<p>{room.userCount} users online</p>
										</div>
										<button onClick={() => joinRoom(room.roomId)} className="action-btn action-lime">Join</button>
									</div>
								))
							)}
						</div>
					</article>
				</section>
			) : (
				<section className="chat-layout">
					<header className="panel chat-header">
						<div>
							<h1>You are in Room {currentRoomId}</h1>
							<p>{roomUserCount} users in this room</p>
						</div>
						<div className="header-actions">
							<button onClick={requestRooms} className="action-btn action-pink">Sync Rooms</button>
							<button onClick={leaveRoom} className="action-btn action-orange">Leave Room</button>
						</div>
					</header>

					<section className="panel feed-panel">
						<h2>Activity</h2>
						<div className="system-feed">
							{systemFeed.length === 0 ? (
								<p className="muted">Room activity will appear here.</p>
							) : (
								systemFeed.map((item, index) => (
									<p key={`${item}-${index}`}>{item}</p>
								))
							)}
						</div>
					</section>

					<section className="panel messages-panel">
						<h2>Chat</h2>
						<div className="messages-list">
							{messages.length === 0 ? (
								<p className="muted">No messages yet. Break the silence.</p>
							) : (
								messages.map((message, index) => {
									const outgoing = message.anonymousId === anonymousId;
									return (
										<article key={`${message.timestamp}-${index}`} className={`message-item ${outgoing ? "outgoing" : "incoming"}`}>
											<div className="message-head">
												<strong>{outgoing ? "You" : message.nickname}</strong>
												<span>{formatTime(message.timestamp)}</span>
											</div>
											<p>{message.message}</p>
										</article>
									);
								})
							)}
						</div>

						<form className="composer" onSubmit={sendMessageToRoom}>
							<input
								value={messageInput}
								onChange={(event) => setMessageInput(event.target.value)}
								placeholder="Type your message..."
								maxLength={500}
							/>
							<button type="submit" className="action-btn action-cyan">Send</button>
						</form>
					</section>
				</section>
			)}

			{errorText ? <aside className="error-toast">{errorText}</aside> : null}
		</main>
	);
}

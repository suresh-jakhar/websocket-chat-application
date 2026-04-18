import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import incomingSound from "./audio/incoming_text_sound.wav";
import joinLeaveSound from "./audio/join-leave-room-sound.wav";
import outgoingSound from "./audio/outgoing_text_sound.wav";
import { BackgroundShapes } from "./components/BackgroundShapes";
import { StatusStrip } from "./components/StatusStrip";
import { ChatPage } from "./pages/ChatPage";
import { HomePage } from "./pages/HomePage";
import { NicknamePage } from "./pages/NicknamePage";
import type { IncomingServerMessage, MessagePayload, RoomSummary, ConnectionStatus } from "./types/chat";
import { generateAnonymousId } from "./utils/chat";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";

export default function App() {
	const socketRef = useRef<WebSocket | null>(null);
	const roomsPollRef = useRef<number | null>(null);
	const nicknameInputRef = useRef<HTMLInputElement | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
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

	useEffect(() => {
		if (!errorText) {
			return;
		}

		const timeout = window.setTimeout(() => {
			setErrorText("");
		}, 2200);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [errorText]);

	const saveNickname = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = nicknameInput.trim();
		if (!trimmed) {
			setErrorText("Enter your name.");
			nicknameInputRef.current?.focus();
			return;
		}
		if (trimmed.length > 30) {
			setErrorText("Name must be 30 characters or less.");
			nicknameInputRef.current?.focus();
			return;
		}
		setNickname(trimmed);
		setErrorText("");
		requestRooms();
	};

	const createRoom = () => {
		if (!nickname) {
			setErrorText("Enter your name first.");
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
			setErrorText("Enter your name first.");
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
			<BackgroundShapes />
			<StatusStrip status={connectionStatus} anonymousId={anonymousId} />

			{!nickname ? (
				<NicknamePage
					nicknameInput={nicknameInput}
					onNicknameInputChange={setNicknameInput}
					onSaveNickname={saveNickname}
					nicknameInputRef={nicknameInputRef}
				/>
			) : currentRoomId === null ? (
				<HomePage
					nickname={nickname}
					rooms={rooms}
					onCreateRoom={createRoom}
					onRequestRooms={requestRooms}
					onJoinRoom={joinRoom}
				/>
			) : (
				<ChatPage
					currentRoomId={currentRoomId}
					roomUserCount={roomUserCount}
					messages={messages}
					systemFeed={systemFeed}
					anonymousId={anonymousId}
					messageInput={messageInput}
					onMessageInputChange={setMessageInput}
					onSendMessage={sendMessageToRoom}
					onRequestRooms={requestRooms}
					onLeaveRoom={leaveRoom}
				/>
			)}

			{errorText ? <aside className="error-toast">{errorText}</aside> : null}
		</main>
	);
}

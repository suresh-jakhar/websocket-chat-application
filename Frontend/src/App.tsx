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
import peopleIllustration from "./assets/hii_from_3_perople.svg";
import type { MessagePayload, RoomSummary, ConnectionStatus } from "./types/chat";
import { generateAnonymousId } from "./utils/chat";

const PIEHOST_CLUSTER_ID = import.meta.env.VITE_PIEHOST_CLUSTER_ID ?? "";
const PIEHOST_API_KEY = import.meta.env.VITE_PIEHOST_API_KEY ?? "";
const PIEHOST_REGISTRY_ROOM = import.meta.env.VITE_PIEHOST_REGISTRY_ROOM ?? "rooms_registry";
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:8080").replace(/\/$/, "");

type PieMessage = {
	event?: string;
	data?: unknown;
	meta?: unknown;
	system?: {
		connection_count?: number;
	};
};

function toRoomName(roomId: number): string {
	return `room-${roomId}`;
}

function buildPieUrl(roomName: string, anonymousId: string): string {
	const clusterId = PIEHOST_CLUSTER_ID.trim();
	const apiKey = PIEHOST_API_KEY.trim();
	const room = encodeURIComponent(roomName);
	const user = encodeURIComponent(anonymousId);
	return `wss://${clusterId}.piesocket.com/v3/${room}?api_key=${apiKey}&notify_self=1&presence=1&user=${user}`;
}

export default function App() {
	const registrySocketRef = useRef<WebSocket | null>(null);
	const roomSocketRef = useRef<WebSocket | null>(null);
	const roomsPollRef = useRef<number | null>(null);
	const nicknameInputRef = useRef<HTMLInputElement | null>(null);
	const nicknameRef = useRef("");
	const currentRoomRef = useRef<number | null>(null);
	const [roomJoinVersion, setRoomJoinVersion] = useState(0);
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
	const [isMuted, setIsMuted] = useState(false);
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
		if (isMuted) {
			return;
		}
		const audio = sounds[kind];
		audio.currentTime = 0;
		void audio.play().catch(() => {
			return;
		});
	};

	const emitPieMessage = (socket: WebSocket | null, message: PieMessage, socketErrorText: string) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			setErrorText(socketErrorText);
			return false;
		}
		socket.send(JSON.stringify(message));
		return true;
	};

	const updateRoomInList = (roomId: number, userCount: number) => {
		setRooms((prev) => {
			const next = [...prev];
			const existingIndex = next.findIndex((room) => room.roomId === roomId);
			if (userCount <= 0) {
				if (existingIndex >= 0) {
					next.splice(existingIndex, 1);
				}
				return next.sort((a, b) => a.roomId - b.roomId);
			}

			if (existingIndex >= 0) {
				next[existingIndex] = { roomId, userCount };
			} else {
				next.push({ roomId, userCount });
			}

			return next.sort((a, b) => a.roomId - b.roomId);
		});
	};

	const requestCurrentRoomStatus = () => {
		const socket = roomSocketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) {
			return;
		}
		socket.send("cmd_status");
	};

	const fetchRoomsFromBackend = async () => {
		try {
			const response = await fetch(`${BACKEND_URL}/rooms`);
			if (!response.ok) {
				throw new Error(`Unable to fetch rooms (${response.status})`);
			}
			const payload = (await response.json()) as { rooms?: RoomSummary[] };
			const safeRooms = (payload.rooms ?? [])
				.filter((room) => Number.isFinite(room.roomId) && Number.isFinite(room.userCount))
				.sort((a, b) => a.roomId - b.roomId);
			setRooms(safeRooms);
		} catch {
			refreshKnownRooms();
		}
	};

	const syncRoomCountToBackend = async (roomId: number, userCount: number) => {
		try {
			await fetch(`${BACKEND_URL}/rooms/${roomId}/count`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ userCount }),
			});
		} catch {
			return;
		}
	};

	const announceRoomCountToRegistry = (roomId: number, userCount: number) => {
		void syncRoomCountToBackend(roomId, userCount);
	};

	const refreshKnownRooms = () => {
		const roomIds = rooms.map((room) => room.roomId);
		if (currentRoomRef.current !== null && !roomIds.includes(currentRoomRef.current)) {
			roomIds.push(currentRoomRef.current);
		}

		const uniqueRoomIds = [...new Set(roomIds)];
		if (uniqueRoomIds.length === 0) {
			return;
		}

		uniqueRoomIds.forEach((roomId) => {
			const statusSocket = new WebSocket(buildPieUrl(toRoomName(roomId), anonymousId));
			let responded = false;

			statusSocket.onopen = () => {
				statusSocket.send("cmd_status");
			};

			statusSocket.onmessage = (event) => {
				let parsed: PieMessage;
				try {
					parsed = JSON.parse(event.data.toString()) as PieMessage;
				} catch {
					return;
				}

				const count = parsed.system?.connection_count;
				if (typeof count === "number") {
					responded = true;
					updateRoomInList(roomId, count);
					statusSocket.close();
				}
			};

			statusSocket.onerror = () => {
				statusSocket.close();
			};

			window.setTimeout(() => {
				if (!responded && statusSocket.readyState === WebSocket.OPEN) {
					statusSocket.close();
				}
			}, 1500);
		});
	};

	const requestRooms = () => {
		void fetchRoomsFromBackend();
	};

	const connectRegistrySocket = () => {
		setConnectionStatus("connecting");
		const socket = new WebSocket(buildPieUrl(PIEHOST_REGISTRY_ROOM, anonymousId));
		registrySocketRef.current = socket;

		socket.onopen = () => {
			setConnectionStatus("connected");
			setErrorText("");
			void fetchRoomsFromBackend();
		};

		socket.onmessage = (event) => {
			let parsed: PieMessage;
			try {
				parsed = JSON.parse(event.data.toString()) as PieMessage;
			} catch {
				return;
			}

			if (parsed.event === "room_created" && parsed.data && typeof parsed.data === "object") {
				const payload = parsed.data as Record<string, unknown>;
				const roomId = payload.roomId;
				if (typeof roomId === "number") {
					updateRoomInList(roomId, 1);
				}
				return;
			}

			if (parsed.event === "room_count_update" && parsed.data && typeof parsed.data === "object") {
				const payload = parsed.data as Record<string, unknown>;
				const roomId = payload.roomId;
				const userCount = payload.userCount;
				if (typeof roomId === "number" && typeof userCount === "number") {
					updateRoomInList(roomId, userCount);
				}
			}
		};

		socket.onclose = () => {
			setConnectionStatus("disconnected");
		};

		socket.onerror = () => {
			setConnectionStatus("disconnected");
		};
	};

	const closeCurrentRoomSocket = () => {
		if (roomSocketRef.current) {
			roomSocketRef.current.close();
			roomSocketRef.current = null;
		}
	};

	const joinRoomSocket = (roomId: number) => {
		closeCurrentRoomSocket();
		currentRoomRef.current = roomId;

		const socket = new WebSocket(buildPieUrl(toRoomName(roomId), anonymousId));
		roomSocketRef.current = socket;

		socket.onopen = () => {
			setCurrentRoomId(roomId);
			setRoomUserCount(1);
			setMessages([]);
			setSystemFeed([`You joined Room ${roomId}.`]);
			playSound("joinLeave");

			emitPieMessage(
				socket,
				{
					event: "user_joined",
					data: {
						roomId,
						anonymousId,
						nickname: nicknameRef.current,
					},
				},
				"Unable to send join signal."
			);

			requestCurrentRoomStatus();
			announceRoomCountToRegistry(roomId, 1);
		};

		socket.onmessage = (event) => {
			let parsed: PieMessage;
			try {
				parsed = JSON.parse(event.data.toString()) as PieMessage;
			} catch {
				return;
			}

			if (typeof parsed.system?.connection_count === "number") {
				const connectionCount = parsed.system.connection_count;
				setRoomUserCount(connectionCount);
				if (currentRoomRef.current !== null) {
					announceRoomCountToRegistry(currentRoomRef.current, connectionCount);
				}
				return;
			}

			if (!parsed.event || !parsed.data || typeof parsed.data !== "object") {
				return;
			}

			const payload = parsed.data as Record<string, unknown>;

			if (parsed.event === "user_joined") {
				const joinedBy = payload.nickname;
				const joinedByAnon = payload.anonymousId;
				if (typeof joinedBy === "string" && joinedByAnon !== anonymousId) {
					setSystemFeed((prev) => [...prev.slice(-14), `${joinedBy} joined the room.`]);
					playSound("joinLeave");
				}
				requestCurrentRoomStatus();
				return;
			}

			if (parsed.event === "user_left") {
				const leftBy = payload.nickname;
				if (typeof leftBy === "string") {
					setSystemFeed((prev) => [...prev.slice(-14), `${leftBy} left the room.`]);
					playSound("joinLeave");
				}
				requestCurrentRoomStatus();
				return;
			}

			if (parsed.event === "chat_message") {
				const message = payload.message;
				const senderId = payload.anonymousId;
				const senderName = payload.nickname;
				const timestamp = payload.timestamp;

				if (
					typeof message !== "string" ||
					typeof senderId !== "string" ||
					typeof senderName !== "string" ||
					typeof timestamp !== "string"
				) {
					return;
				}

				const normalized: MessagePayload = {
					anonymousId: senderId,
					nickname: senderName,
					message,
					timestamp,
				};

				setMessages((prev) => [...prev, normalized]);
				if (normalized.anonymousId !== anonymousId) {
					playSound("incoming");
				}
			}
		};

		socket.onclose = () => {
			roomSocketRef.current = null;
		};

		socket.onerror = () => {
			setErrorText("Room connection failed.");
		};
	};

	useEffect(() => {
		if (!PIEHOST_CLUSTER_ID || !PIEHOST_API_KEY) {
			setConnectionStatus("disconnected");
			setErrorText("PieHost env vars are missing. Set VITE_PIEHOST_CLUSTER_ID and VITE_PIEHOST_API_KEY.");
			return;
		}

		connectRegistrySocket();

		roomsPollRef.current = window.setInterval(() => {
			if (registrySocketRef.current?.readyState === WebSocket.OPEN) {
				requestRooms();
			}
		}, 3000);

		return () => {
			if (roomsPollRef.current) {
				window.clearInterval(roomsPollRef.current);
			}
			registrySocketRef.current?.close();
			roomSocketRef.current?.close();
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

	useEffect(() => {
		nicknameRef.current = nickname;
	}, [nickname]);

	useEffect(() => {
		if (currentRoomRef.current === null) {
			return;
		}
		requestCurrentRoomStatus();
	}, [roomJoinVersion]);

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

		void (async () => {
			try {
				const response = await fetch(`${BACKEND_URL}/rooms`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						nickname,
						anonymousId,
					}),
				});

				if (!response.ok) {
					const payload = (await response.json().catch(() => ({}))) as { error?: string };
					setErrorText(payload.error ?? "Unable to create room right now.");
					return;
				}

				const payload = (await response.json()) as { roomId?: number };
				if (typeof payload.roomId !== "number") {
					setErrorText("Room creation returned an invalid response.");
					return;
				}

				updateRoomInList(payload.roomId, 1);
				joinRoom(payload.roomId);
			} catch {
				setErrorText("Unable to reach backend for room creation.");
			}
		})();
	};

	const joinRoom = (roomId: number) => {
		if (!nickname) {
			setErrorText("Enter your name first.");
			return;
		}
		setRoomJoinVersion((prev) => prev + 1);
		joinRoomSocket(roomId);
	};

	const leaveRoom = () => {
		const roomId = currentRoomRef.current;
		if (roomId === null) {
			return;
		}

		emitPieMessage(
			roomSocketRef.current,
			{
				event: "user_left",
				data: {
					roomId,
					anonymousId,
					nickname: nicknameRef.current,
				},
			},
			"Unable to signal room leave."
		);

		closeCurrentRoomSocket();
		currentRoomRef.current = null;
		setCurrentRoomId(null);
		setRoomUserCount(0);
		setMessages([]);
		setSystemFeed([]);
		playSound("joinLeave");
		announceRoomCountToRegistry(roomId, 0);
		requestRooms();
	};

	const sendMessageToRoom = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = messageInput.trim();
		if (!trimmed) {
			return;
		}
		playSound("outgoing");
		const sent = emitPieMessage(
			roomSocketRef.current,
			{
				event: "chat_message",
				data: {
					anonymousId,
					nickname,
					message: trimmed,
					timestamp: new Date().toISOString(),
				},
			},
			"Room is not connected right now."
		);
		if (!sent) {
			return;
		}
		setMessageInput("");
	};

	const isLanding = !nickname;

	return (
		<main className={`app-root${isLanding ? " app-root-landing" : ""}`}>
			<BackgroundShapes />
			<StatusStrip status={connectionStatus} anonymousId={anonymousId} />

			{isLanding ? (
				<div className="landing-stage">
					<NicknamePage
						nicknameInput={nicknameInput}
						onNicknameInputChange={setNicknameInput}
						onSaveNickname={saveNickname}
						nicknameInputRef={nicknameInputRef}
					/>
					<img className="landing-illustration" src={peopleIllustration} alt="Three people waving" />
				</div>
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
					isMuted={isMuted}
					messageInput={messageInput}
					onMessageInputChange={setMessageInput}
					onSendMessage={sendMessageToRoom}
					onToggleMute={() => setIsMuted((prev) => !prev)}
					onRequestRooms={requestRooms}
					onLeaveRoom={leaveRoom}
				/>
			)}

			{errorText ? <aside className="error-toast">{errorText}</aside> : null}
		</main>
	);
}

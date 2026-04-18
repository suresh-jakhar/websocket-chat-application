import type { FormEvent } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppInput } from "../components/AppInput";
import { MessageList } from "../components/MessageList";
import { SystemFeed } from "../components/SystemFeed";
import type { MessagePayload } from "../types/chat";

type ChatPageProps = {
    currentRoomId: number;
    roomUserCount: number;
    messages: MessagePayload[];
    systemFeed: string[];
    anonymousId: string;
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
    onRequestRooms: () => void;
    onLeaveRoom: () => void;
};

export function ChatPage({
    currentRoomId,
    roomUserCount,
    messages,
    systemFeed,
    anonymousId,
    messageInput,
    onMessageInputChange,
    onSendMessage,
    onRequestRooms,
    onLeaveRoom,
}: ChatPageProps) {
    return (
        <section className="chat-layout">
            <header className="panel chat-header">
                <div>
                    <h1>You are in Room {currentRoomId}</h1>
                    <p>{roomUserCount} users in this room</p>
                </div>
                <div className="header-actions">
                    <ActionButton onClick={onRequestRooms} tone="pink">
                        Sync Rooms
                    </ActionButton>
                    <ActionButton onClick={onLeaveRoom} tone="orange">
                        Leave Room
                    </ActionButton>
                </div>
            </header>

            <section className="panel feed-panel">
                <h2>Activity</h2>
                <SystemFeed items={systemFeed} />
            </section>

            <section className="panel messages-panel">
                <h2>Chat</h2>
                <MessageList messages={messages} anonymousId={anonymousId} />

                <form className="composer" onSubmit={onSendMessage}>
                    <AppInput
                        value={messageInput}
                        onChange={onMessageInputChange}
                        placeholder="Type your message..."
                        maxLength={500}
                    />
                    <ActionButton type="submit" tone="cyan">
                        Send
                    </ActionButton>
                </form>
            </section>
        </section>
    );
}

import type { FormEvent } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppInput } from "../components/AppInput";
import { ExitIcon } from "../icons/exit";
import { SoundOffIcon } from "../icons/sound_off";
import { SoundOnIcon } from "../icons/sound_on";
import { SyncIcon } from "../icons/sync";
import { MessageList } from "../components/MessageList";
import { SystemFeed } from "../components/SystemFeed";
import type { MessagePayload } from "../types/chat";

type ChatPageProps = {
    currentRoomId: number;
    roomUserCount: number;
    messages: MessagePayload[];
    systemFeed: string[];
    anonymousId: string;
    isMuted: boolean;
    messageInput: string;
    onMessageInputChange: (value: string) => void;
    onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
    onToggleMute: () => void;
    onRequestRooms: () => void;
    onLeaveRoom: () => void;
};

export function ChatPage({
    currentRoomId,
    roomUserCount,
    messages,
    systemFeed,
    anonymousId,
    isMuted,
    messageInput,
    onMessageInputChange,
    onSendMessage,
    onToggleMute,
    onRequestRooms,
    onLeaveRoom,
}: ChatPageProps) {
    return (
        <section className="chat-layout">
            <section className="panel feed-panel activity-panel">
                <div className="panel-top activity-panel-top">
                    <h2>Activity</h2>
                </div>
                <SystemFeed items={systemFeed} />
            </section>

            <section className="panel messages-panel">
                <div className="panel-top chat-panel-top">
                    <h2 className="chat-room-title">Room {currentRoomId}</h2>
                    <div className="header-actions">
                        <span className="chat-room-count">{roomUserCount} Online</span>
                        <ActionButton onClick={onToggleMute} tone="lime">
                            <span className="mute-btn-content">
                                <span className="mute-btn-icon" aria-hidden="true">
                                    {isMuted ? <SoundOffIcon /> : <SoundOnIcon />}
                                </span>
                                <span>{isMuted ? "Unmute" : "Mute"}</span>
                            </span>
                        </ActionButton>
                        <ActionButton onClick={onRequestRooms} tone="pink">
                            <span className="action-btn-with-icon">
                                <span className="action-btn-icon" aria-hidden="true">
                                    <SyncIcon />
                                </span>
                                <span>Sync</span>
                            </span>
                        </ActionButton>
                        <ActionButton onClick={onLeaveRoom} tone="orange">
                            <span className="action-btn-with-icon">
                                <span className="action-btn-icon" aria-hidden="true">
                                    <ExitIcon />
                                </span>
                                <span>Leave</span>
                            </span>
                        </ActionButton>
                    </div>
                </div>
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

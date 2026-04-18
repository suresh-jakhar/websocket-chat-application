import { useEffect, useRef } from "react";
import { formatTime } from "../utils/chat";
import type { MessagePayload } from "../types/chat";

type MessageListProps = {
    messages: MessagePayload[];
    anonymousId: string;
};

export function MessageList({ messages, anonymousId }: MessageListProps) {
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, [messages]);

    return (
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
            <div ref={bottomRef} />
        </div>
    );
}

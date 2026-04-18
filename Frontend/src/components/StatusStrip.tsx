import type { ConnectionStatus } from "../types/chat";

type StatusStripProps = {
    status: ConnectionStatus;
    wsUrl: string;
    anonymousId: string;
};

export function StatusStrip({ status, wsUrl, anonymousId }: StatusStripProps) {
    return (
        <section className="status-strip">
            <strong>Server:</strong>
            <span className={`status-pill ${status}`}>{status}</span>
            <span className="env-pill">{wsUrl}</span>
            <span className="env-pill">ID: {anonymousId}</span>
        </section>
    );
}

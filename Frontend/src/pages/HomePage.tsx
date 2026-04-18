import { ActionButton } from "../components/ActionButton";
import { RoomList } from "../components/RoomList";
import type { RoomSummary } from "../types/chat";

type HomePageProps = {
    nickname: string;
    rooms: RoomSummary[];
    onCreateRoom: () => void;
    onRequestRooms: () => void;
    onJoinRoom: (roomId: number) => void;
};

export function HomePage({ nickname, rooms, onCreateRoom, onRequestRooms, onJoinRoom }: HomePageProps) {
    return (
        <section className="home-stage">
            <div className="home-backdrop" aria-hidden="true">
                WELCOME, {nickname}
            </div>

            <div className="home-stack">
                <article className="panel home-card create-room-card">
                    <h1>Create Room</h1>
                    <p>Start a new room and share the room ID with others.</p>
                    <ActionButton onClick={onCreateRoom} tone="cyan">
                        Create Room
                    </ActionButton>
                </article>

                <article className="panel home-card join-room-card">
                    <div className="panel-top">
                        <h2>Join Room</h2>
                        <ActionButton onClick={onRequestRooms} tone="pink">
                            Refresh
                        </ActionButton>
                    </div>

                    <RoomList rooms={rooms} onJoinRoom={onJoinRoom} />
                </article>
            </div>
        </section>
    );
}

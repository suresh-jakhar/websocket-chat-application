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
        <section className="layout-grid">
            <article className="panel hero-panel">
                <h1>Welcome, {nickname}</h1>
                <p>Create a room or join any active room below. Room IDs are numeric and fully ephemeral.</p>
                <ActionButton onClick={onCreateRoom} tone="cyan">
                    Create Room
                </ActionButton>
            </article>

            <article className="panel room-list-panel">
                <div className="panel-top">
                    <h2>Active Rooms</h2>
                    <ActionButton onClick={onRequestRooms} tone="pink">
                        Refresh
                    </ActionButton>
                </div>

                <RoomList rooms={rooms} onJoinRoom={onJoinRoom} />
            </article>
        </section>
    );
}

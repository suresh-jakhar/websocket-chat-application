import { ActionButton } from "./ActionButton";
import type { RoomSummary } from "../types/chat";

type RoomListProps = {
    rooms: RoomSummary[];
    onJoinRoom: (roomId: number) => void;
};

export function RoomList({ rooms, onJoinRoom }: RoomListProps) {
    return (
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
                        <ActionButton onClick={() => onJoinRoom(room.roomId)} tone="lime">
                            Join
                        </ActionButton>
                    </div>
                ))
            )}
        </div>
    );
}

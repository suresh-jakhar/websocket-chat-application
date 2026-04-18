type SystemFeedProps = {
    items: string[];
};

export function SystemFeed({ items }: SystemFeedProps) {
    return (
        <div className="system-feed">
            {items.length === 0 ? (
                <p className="muted">Room activity will appear here.</p>
            ) : (
                items.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
            )}
        </div>
    );
}

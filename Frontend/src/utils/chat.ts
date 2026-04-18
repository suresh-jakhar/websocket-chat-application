export function generateAnonymousId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return `anon_${crypto.randomUUID().slice(0, 8)}`;
    }
    return `anon_${Math.random().toString(36).slice(2, 10)}`;
}

export function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
        return "--:--";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

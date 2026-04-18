import type { ReactNode } from "react";

type ActionButtonProps = {
    onClick?: () => void;
    type?: "button" | "submit";
    tone: "cyan" | "pink" | "lime" | "orange";
    children: ReactNode;
};

const toneClass: Record<ActionButtonProps["tone"], string> = {
    cyan: "action-cyan",
    pink: "action-pink",
    lime: "action-lime",
    orange: "action-orange",
};

export function ActionButton({ onClick, type = "button", tone, children }: ActionButtonProps) {
    return (
        <button onClick={onClick} type={type} className={`action-btn ${toneClass[tone]}`}>
            {children}
        </button>
    );
}

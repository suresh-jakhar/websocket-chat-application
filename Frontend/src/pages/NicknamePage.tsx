import type { FormEvent } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppInput } from "../components/AppInput";

type NicknamePageProps = {
    nicknameInput: string;
    onNicknameInputChange: (value: string) => void;
    onSaveNickname: (event: FormEvent<HTMLFormElement>) => void;
    nicknameInputRef: React.RefObject<HTMLInputElement | null>;
};

export function NicknamePage({ nicknameInput, onNicknameInputChange, onSaveNickname, nicknameInputRef }: NicknamePageProps) {
    return (
        <section className="panel hero-panel">
            <h1>Room Chat</h1>
            <p>Enter your name to start chatting and join numbered rooms.</p>

            <form onSubmit={onSaveNickname} className="nickname-form">
                <AppInput
                    inputRef={nicknameInputRef}
                    value={nicknameInput}
                    onChange={onNicknameInputChange}
                    placeholder="name"
                    maxLength={30}
                />
                <ActionButton type="submit" tone="cyan">
                    Start Chatting
                </ActionButton>
            </form>
        </section>
    );
}

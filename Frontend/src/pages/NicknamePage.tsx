import type { FormEvent } from "react";
import { ActionButton } from "../components/ActionButton";
import { AppInput } from "../components/AppInput";

type NicknamePageProps = {
    nicknameInput: string;
    onNicknameInputChange: (value: string) => void;
    onSaveNickname: (event: FormEvent<HTMLFormElement>) => void;
};

export function NicknamePage({ nicknameInput, onNicknameInputChange, onSaveNickname }: NicknamePageProps) {
    return (
        <section className="panel hero-panel">
            <h1>Neo Brutal Rooms</h1>
            <p>
                Loud colors, thick borders, live chat. Pick a mandatory nickname and jump into numeric rooms instantly.
            </p>

            <form onSubmit={onSaveNickname} className="nickname-form">
                <AppInput
                    value={nicknameInput}
                    onChange={onNicknameInputChange}
                    placeholder="mandatory nickname"
                    maxLength={30}
                />
                <ActionButton type="submit" tone="cyan">
                    Start Chatting
                </ActionButton>
            </form>
        </section>
    );
}

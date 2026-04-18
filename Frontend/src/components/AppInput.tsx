type AppInputProps = {
    value: string;
    placeholder: string;
    maxLength?: number;
    autoFocus?: boolean;
    inputRef?: React.RefObject<HTMLInputElement | null>;
    onChange: (value: string) => void;
};

export function AppInput({ value, placeholder, maxLength, autoFocus, inputRef, onChange }: AppInputProps) {
    return (
        <input
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            autoFocus={autoFocus}
        />
    );
}

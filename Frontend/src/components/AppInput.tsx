type AppInputProps = {
    value: string;
    placeholder: string;
    maxLength?: number;
    onChange: (value: string) => void;
};

export function AppInput({ value, placeholder, maxLength, onChange }: AppInputProps) {
    return (
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
        />
    );
}

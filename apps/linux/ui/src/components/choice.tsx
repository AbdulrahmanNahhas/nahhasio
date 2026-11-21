import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function Choice({
  label,
  value,
  options,
  onChange,
  id,
  animatePopup = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  id?: string;
  animatePopup?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-32.5 flex-1 sm:min-w-37.5">
      <Select
        items={options}
        disabled={disabled}
        value={value}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
      >
        <SelectTrigger id={id} aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={!animatePopup}
          align="start"
          className={
            animatePopup
              ? "motion-safe:transition motion-safe:duration-150 motion-safe:data-starting-style:-translate-y-1 motion-safe:data-starting-style:opacity-0 motion-safe:data-ending-style:-translate-y-1 motion-safe:data-ending-style:opacity-0"
              : undefined
          }
        >
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

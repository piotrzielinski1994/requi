import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type Environment = { id: string; name: string; color: string };

const MOCK_ENVS: Environment[] = [
  { id: "prod", name: "prod", color: "var(--color-red-500)" },
];

export function EnvSelector() {
  const active = MOCK_ENVS[0];

  return (
    <Select value={active.id}>
      <SelectTrigger
        aria-label="Environment"
        className="h-full gap-2 rounded-none border-0 border-l border-l-border bg-transparent px-3 text-xs shadow-none hover:bg-accent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-accent"
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: active.color }}
        />
        {active.name}
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {MOCK_ENVS.map((env) => (
          <SelectItem key={env.id} value={env.id}>
            <span className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: env.color }}
              />
              {env.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

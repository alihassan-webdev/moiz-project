import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";

type AppSettings = {
  initialTimeoutMs: number;
  retryTimeoutMs: number;
  autoRetry: boolean;
  defaultQuery: string;
};

const STORAGE_KEY = "app:settings" as const;

const DEFAULTS: AppSettings = {
  initialTimeoutMs: 25000,
  retryTimeoutMs: 55000,
  autoRetry: true,
  defaultQuery: "",
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        setSettings({ ...DEFAULTS, ...parsed });
      }
    } catch {}
  }, []);

  const save = () => {
    if (settings.initialTimeoutMs < 5000 || settings.retryTimeoutMs < 5000) {
      toast({
        title: "Invalid timeout",
        description: "Timeouts must be at least 5000 ms.",
      });
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    toast({ title: "Saved", description: "Settings updated." });
  };

  const reset = () => {
    setSettings(DEFAULTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
    toast({ title: "Reset", description: "Settings reset to defaults." });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Control timeouts and defaults for generation.
        </p>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <div className="grid gap-2">
          <Label htmlFor="initialTimeoutMs">Initial request timeout (ms)</Label>
          <Input
            id="initialTimeoutMs"
            type="number"
            min={5000}
            value={settings.initialTimeoutMs}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                initialTimeoutMs: Number(e.target.value),
              }))
            }
            className="focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="retryTimeoutMs">Retry request timeout (ms)</Label>
          <Input
            id="retryTimeoutMs"
            type="number"
            min={5000}
            value={settings.retryTimeoutMs}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                retryTimeoutMs: Number(e.target.value),
              }))
            }
            className="focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="autoRetry">Auto retry on timeout</Label>
            <p className="text-xs text-muted-foreground">
              When enabled, the app retries once if the first request times out.
            </p>
          </div>
          <Switch
            id="autoRetry"
            checked={settings.autoRetry}
            onCheckedChange={(v) =>
              setSettings((s) => ({ ...s, autoRetry: v }))
            }
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="defaultQuery">Default query</Label>
          <Textarea
            id="defaultQuery"
            rows={4}
            placeholder="e.g. Generate 10 multiple-choice questions covering key concepts"
            value={settings.defaultQuery}
            onChange={(e) =>
              setSettings((s) => ({ ...s, defaultQuery: e.target.value }))
            }
            className="focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={save}>
            Save
          </Button>
          <Button
            variant="outline"
            onClick={reset}
            className="text-white hover:bg-transparent hover:border-transparent"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-3">Account</h2>
        <p className="text-sm text-muted-foreground mb-4">
          You are using a demo login. You can log out anytime.
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";

const DEMO_EMAIL = "demo@demo.com" as const;
const DEMO_PASSWORD = "demo123" as const;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      toast({ title: "Missing fields", description: "Enter email and password." });
      return;
    }

    setLoading(true);
    try {
      if (em.toLowerCase() === DEMO_EMAIL && pw === DEMO_PASSWORD) {
        login(em);
        toast({ title: "Welcome", description: "Login successful." });
        navigate("/", { replace: true });
      } else {
        toast({ title: "Invalid credentials", description: "Use demo@demo.com with password demo123." });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 sm:p-10 card-surface">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-secondary">Log in</h1>
          <p className="text-sm text-muted-foreground">Demo access only. Use demo@demo.com / demo123</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="demo@demo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="demo123"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
            />
          </div>
          <Button type="submit" className="w-full" variant="secondary" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

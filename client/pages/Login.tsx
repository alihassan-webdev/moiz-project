import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { login } from "@/lib/auth";

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
      toast({
        title: "Missing fields",
        description: "Enter email and password.",
      });
      return;
    }

    setLoading(true);
    try {
      login(em);
      toast({ title: "Welcome", description: "Logged in (demo)." });
      navigate("/", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 sm:p-10 card-surface">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-secondary">Log in</h1>
          <p className="text-sm text-muted-foreground">
            Demo login: enter any email and password
          </p>
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
              className="input-black bg-black text-white placeholder:text-white/60 focus:bg-black focus-visible:bg-black focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
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
              className="input-black bg-black text-white placeholder:text-white/60 focus:bg-black focus-visible:bg-black focus-visible:ring-secondary focus-visible:border-secondary focus:border-secondary"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            variant="secondary"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

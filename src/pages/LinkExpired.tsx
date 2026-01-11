import { useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function LinkExpired() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState<string>(params.get("email") || "");
  const type = (params.get("type") || "recovery") as "invite" | "recovery";
  const error = params.get("error") || "";
  const description = params.get("description") || "";

  const verifyHref = useMemo(() => {
    const u = new URL(window.location.origin + "/auth/verify");
    u.searchParams.set("type", type);
    if (email) u.searchParams.set("email", email);
    return u.pathname + u.search;
  }, [type, email]);

  const resendReset = async () => {
    const target = email || params.get("email") || "";
    if (!target) {
      toast.error("Enter your email to send a new reset email");
      return;
    }
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Sent a new password reset email.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Link issue</CardTitle>
          <CardDescription>
            {error ? `Error: ${error}` : "Your link may have expired or been auto-clicked by a security scanner."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {description && (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Quick actions</div>
            <div className="flex flex-wrap gap-2">
              <Link to={verifyHref}>
                <Button variant="outline">Verify with 6-digit code</Button>
              </Link>
              {type === "recovery" && (
                <Button variant="outline" onClick={resendReset}>Send new reset email</Button>
              )}
              {type === "invite" && (
                <Button variant="outline" onClick={() => toast.info("Ask an admin to resend your invite, or use the code from the email if available.")}>Request new invite</Button>
              )}
              <Link to="/auth">
                <Button variant="ghost">Back to Auth</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

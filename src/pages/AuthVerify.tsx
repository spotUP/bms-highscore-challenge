import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

// Reuse existing UI primitives if available
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A small helper to normalize types
type OtpType = "invite" | "recovery";

export default function AuthVerify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState<string>(searchParams.get("email") || "");
  const [code, setCode] = useState<string>("");
  const [type, setType] = useState<OtpType>(((searchParams.get("type") as OtpType) || "recovery"));
  const [newPassword, setNewPassword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // If no email is present from params, try to hydrate from last_reset_email
  useEffect(() => {
    if (!email) {
      try {
        const last = localStorage.getItem("last_reset_email");
        if (last) setEmail(last);
      } catch {}
    }
  }, []);

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    if (!code) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type,
      });

      if (error) throw error;

      // For recovery, user must set a new password after verify
      if (type === "recovery") {
        if (!newPassword) {
          toast.success("Code verified. Please set a new password to complete the reset.");
          setLoading(false);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
        if (updateError) throw updateError;
        toast.success("Your password has been updated. You're now signed in.");
        navigate("/", { replace: true });
        return;
      }

      // For invite, verifyOtp will establish a session; navigate home or to onboarding
      toast.success("Invite verified. You're signed in.");
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = err?.message || "Verification failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendReset = async () => {
    if (!email) {
      toast.error("Enter your email to resend the reset link");
      return;
    }
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("We sent you a new password reset email. Check your inbox.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 bg-black/30 backdrop-blur rounded-xl border border-white/10 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white">Verify code</h1>
          <p className="text-sm text-white/70">
            If your email client auto-clicked the link, paste the code from the email here.
          </p>
        </div>

        <form onSubmit={onVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type" className="text-white">Type</Label>
            <select
              id="type"
              className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-white"
              value={type}
              onChange={(e) => setType(e.target.value as OtpType)}
            >
              <option value="recovery">Password reset</option>
              <option value="invite">Invite</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="code" className="text-white">6-digit code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>

          {type === "recovery" && (
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-white">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter a new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading} variant="outline">
              {loading ? "Verifying..." : "Verify"}
            </Button>
            {type === "recovery" && (
              <Button type="button" variant="ghost" onClick={resendReset}>
                Resend reset email
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-white/60">
          Tip: Our emails include both the action link and the numeric code. If the link is consumed by a security scanner, use the code here.
        </p>
      </div>
    </div>
  );
}

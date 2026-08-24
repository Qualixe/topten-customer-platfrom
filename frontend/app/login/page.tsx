import { LoginForm } from "@/components/auth/login-form";
import { SiteLogoHeader } from "@/components/branding/site-logo-header";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-6">
      <header className="py-6">
        <SiteLogoHeader />
      </header>

      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">
          Sign in to manage your customer platform.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}

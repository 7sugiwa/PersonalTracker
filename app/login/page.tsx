import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <form
        method="POST"
        action="/api/login"
        className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-ink">PersonalTracker</h1>
        <p className="mb-4 text-sm text-ink-secondary">Enter the dashboard password.</p>
        {error && (
          <p className="mb-3 rounded-lg bg-negative-surface px-3 py-2 text-sm text-negative">
            Wrong password.
          </p>
        )}
        <Input
          type="password"
          name="password"
          autoFocus
          required
          className="mb-3"
          placeholder="Password"
        />
        <Button type="submit" variant="primary" className="w-full">
          Log in
        </Button>
      </form>
    </div>
  );
}

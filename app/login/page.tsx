export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <form
        method="POST"
        action="/api/login"
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">
          PersonalTracker
        </h1>
        <p className="mb-4 text-sm text-neutral-500">
          Enter the dashboard password.
        </p>
        {error && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            Wrong password.
          </p>
        )}
        <input
          type="password"
          name="password"
          autoFocus
          required
          className="mb-3 w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          placeholder="Password"
        />
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Log in
        </button>
      </form>
    </div>
  );
}

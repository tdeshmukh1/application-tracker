import { auth, signIn, signOut } from "@/auth";
import SyncButton from "@/components/SyncButton";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Application Tracker
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Connect your Gmail to build your job application board.
        </p>

        {session ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              Signed in as{" "}
              <span className="font-medium">{session.user?.email}</span>
            </div>
            <SyncButton />
            <a
              href="/applications"
              className="block text-sm font-medium text-zinc-700 underline"
            >
              View applications
            </a>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("google");
            }}
          >
            <button
              type="submit"
              className="w-full rounded-full bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Sign in with Google
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

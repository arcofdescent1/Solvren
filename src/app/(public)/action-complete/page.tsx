import Link from "next/link";

type Search = { state?: string };

export default async function ActionCompletePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const state = sp.state ?? "success";

  const copy: Record<string, { title: string; body: string }> = {
    success: {
      title: "Decision recorded",
      body: "You can close this window.",
    },
    expired: {
      title: "Link expired",
      body: "This action link has expired. Open Solvren to continue.",
    },
    used: {
      title: "Already completed",
      body: "This action has already been used.",
    },
    unauthorized: {
      title: "Unauthorized",
      body: "You do not have permission to perform this action.",
    },
    invalid: {
      title: "Invalid link",
      body: "This link is not valid.",
    },
  };

  const c = copy[state] ?? copy.invalid;

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-[var(--text)]">{c.title}</h1>
      <p className="mt-3 text-sm text-[var(--text-muted)]">{c.body}</p>
      <Link href="/login" className="mt-8 text-sm font-semibold text-[var(--primary)] hover:underline">
        Sign in to Solvren
      </Link>
    </div>
  );
}

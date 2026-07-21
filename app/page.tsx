import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
        AI execution strategist
      </span>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
        From idea to execution
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-500">
        Describe a goal in one sentence. Vector reasons about it — generating
        milestones, tasks, and a dependency-aware roadmap that adapts as your
        requirements change.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login">
          <Button>Get started</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="secondary">Go to dashboard</Button>
        </Link>
      </div>
    </main>
  );
}

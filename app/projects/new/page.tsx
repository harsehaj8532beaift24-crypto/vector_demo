"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { api, ApiClientError } from "@/lib/api/client";
import { useDiscover } from "@/lib/hooks/queries";
import {
  Button,
  Card,
  Input,
  Textarea,
  Spinner,
} from "@/components/ui/primitives";

export default function NewProjectPage() {
  const router = useRouter();
  const discover = useDiscover();

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [timeline, setTimeline] = useState("");
  const [questions, setQuestions] = useState<
    Array<{ question: string; why: string }>
  >([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function askQuestions() {
    setError(null);
    try {
      const result = await discover.mutateAsync(goal);
      setQuestions(result.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get questions");
    }
  }

  async function generate() {
    setError(null);
    setSubmitting(true);
    try {
      const project = await api.createProject({
        title: title || goal.slice(0, 60),
        goal,
        timeline: timeline || null,
      });
      const collected = questions
        .map((q, i) => ({ question: q.question, answer: answers[i] ?? "" }))
        .filter((a) => a.answer.trim().length > 0);
      await api.generateRoadmap(
        project.id,
        collected.length > 0 ? collected : undefined,
      );
      router.push(`/projects/${project.id}/roadmap`);
    } catch (e) {
      setSubmitting(false);
      setError(
        e instanceof ApiClientError
          ? e.message
          : "Something went wrong generating the roadmap",
      );
    }
  }

  const canSubmit = goal.trim().length > 0 && !submitting;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold text-slate-900">
          New project
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Describe your goal in a sentence. Vector will plan the execution.
        </p>

        <Card className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Goal
            </label>
            <Textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Build an AI-powered food delivery app"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Title <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto from goal"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Timeline <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                value={timeline}
                onChange={(e) => setTimeline(e.target.value)}
                placeholder="e.g. 3 months"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={askQuestions}
              disabled={!goal.trim() || discover.isPending}
            >
              {discover.isPending ? "Thinking…" : "Refine with AI questions"}
            </Button>
          </div>
        </Card>

        {questions.length > 0 && (
          <Card className="mt-4 flex flex-col gap-4">
            <p className="text-sm font-medium text-slate-700">
              A few questions to sharpen the plan
            </p>
            {questions.map((q, i) => (
              <div key={i}>
                <label className="mb-1 block text-sm text-slate-700">
                  {q.question}
                </label>
                <p className="mb-1 text-xs text-slate-400">{q.why}</p>
                <Input
                  value={answers[i] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [i]: e.target.value }))
                  }
                />
              </div>
            ))}
          </Card>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={generate} disabled={!canSubmit}>
            {submitting ? "Generating roadmap…" : "Generate roadmap"}
          </Button>
          {submitting && <Spinner label="Claude is reasoning about your goal…" />}
        </div>
      </main>
    </div>
  );
}

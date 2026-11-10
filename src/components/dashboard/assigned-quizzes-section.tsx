"use client";

import { useEffect, useState } from "react";
import { createSessionRequestController, releaseSessionRequestController } from "@/lib/auth/session-state";
import { parseAssignedQuizzes } from "@/lib/classes/client";
import { readStudentResponse } from "@/lib/classes/student-request";
import {
  PixelButton,
  PixelBadge,
  PixelCard,
} from "@/components/ui/pixel-primitives";
import type { AssignedQuiz } from "@/lib/classes/client";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatDeadline(value: string | null): string {
  if (!value) return "No deadline";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "No deadline" : dateFormatter.format(date);
}

type Status = { label: string; variant: "info" | "success" | "warning" | "danger" };

/** The one thing a student needs to know about a quiz at a glance. */
export function quizStatus(quiz: AssignedQuiz): Status {
  if (quiz.isExpired) return { label: "Closed", variant: "danger" };
  if (quiz.attemptsRemaining === 0) {
    return { label: "No attempts left", variant: "warning" };
  }
  if (quiz.completed) return { label: "Finished", variant: "success" };

  return { label: "To do", variant: "info" };
}

/**
 * Quizzes the teacher sent to this student or their class. Quizzes are played
 * in the mobile app, so this is a to-do list, not a player.
 */
export function AssignedQuizzesSection() {
  const [quizzes, setQuizzes] = useState<AssignedQuiz[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = createSessionRequestController();
    async function load() {
      try {
        const response = await fetch("/api/assigned-quizzes", {
          cache: "no-store", signal: controller.signal,
        });
        const data = parseAssignedQuizzes(await readStudentResponse(response));
        if (!controller.signal.aborted) setQuizzes(data);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Quizzes could not be loaded. Please retry.");
      } finally {
        releaseSessionRequestController(controller);
      }
    }
    void load();
    return () => { controller.abort(); releaseSessionRequestController(controller); };
  }, [attempt]);
  return (
    <div className="space-y-2 sm:space-y-3">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Quizzes</h2>
        <p className="mt-1 text-sm text-px-muted">
          Quizzes your teacher sent to you or your class. Open the Fili-QuizMo
          app to take them.
        </p>
      </div>

      {error ? (
        <PixelCard>
          <p role="alert" className="text-sm">{error}</p>
          <PixelButton className="mt-3" onClick={() => { setError(""); setAttempt((value) => value + 1); }}>Retry</PixelButton>
        </PixelCard>
      ) : quizzes === null ? (
        <p role="status" className="text-sm">Loading your assigned quizzes...</p>
      ) : quizzes.length === 0 ? (
        <PixelCard>
          <p className="text-sm">
            No quizzes have been sent to you yet. When your teacher sends one
            to you or your class, it will show up here.
          </p>
        </PixelCard>
      ) : (
        <ul className="space-y-2 sm:space-y-3">
          {quizzes.map((quiz) => {
            const status = quizStatus(quiz);

            return (
              <li key={quiz.sessionId}>
                <PixelCard>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="break-words font-bold">{quiz.title}</h3>
                      {quiz.teacherUsername ? (
                        <p className="text-xs text-px-muted">
                          From {quiz.teacherUsername}
                        </p>
                      ) : null}
                    </div>
                    <PixelBadge variant={status.variant}>{status.label}</PixelBadge>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-neutral-500">Questions</dt>
                      <dd className="font-semibold">{quiz.totalQuestions}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Attempts</dt>
                      <dd className="font-semibold">
                        {quiz.maxAttempts === null
                          ? `${quiz.attemptsUsed} used`
                          : `${quiz.attemptsUsed} of ${quiz.maxAttempts}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Timer</dt>
                      <dd className="font-semibold">
                        {quiz.isTimeAttack ? `${quiz.timeAttackSeconds}s` : "None"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-500">Deadline</dt>
                      <dd className="font-semibold">
                        {formatDeadline(quiz.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                </PixelCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { PixelBadge, PixelCard } from "@/components/ui/pixel-primitives";
import type { ClassDashboardView } from "@/lib/dashboard/data";

/**
 * For each class, the quizzes sent to it: how many students finished, the
 * class average, and who has not taken it yet. A class chosen in the Scores
 * filter shows alone; otherwise every class that has been sent a quiz shows.
 */
export function ClassProgress({
  classViews,
  selectedClassId,
}: {
  classViews: readonly ClassDashboardView[];
  selectedClassId: string;
}) {
  const shown = classViews.filter(
    (item) =>
      item.quizProgress.length > 0 &&
      (!selectedClassId || item.classId === selectedClassId),
  );

  if (shown.length === 0) return null;

  return (
    <PixelCard as="section" aria-label="Class quiz progress" className="space-y-2">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Class progress</h3>
        <p className="text-xs text-px-muted sm:text-sm">
          Quizzes sent to a class: who finished, the class average (each
          student&apos;s best score), and who has not taken it yet.
        </p>
      </div>

      {shown.map((item) => (
        <details
          key={item.classId}
          open={shown.length === 1}
          className="border-2 border-ink"
        >
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold">
            {item.name}
            <span className="ml-2 font-normal text-px-muted">
              {item.quizProgress.length}{" "}
              {item.quizProgress.length === 1 ? "quiz" : "quizzes"}
            </span>
          </summary>

          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full text-left text-xs sm:text-sm">
              <caption className="sr-only">Quiz progress for {item.name}</caption>
              <thead>
                <tr>
                  <th scope="col" className="py-1.5 pr-3">Quiz</th>
                  <th scope="col" className="py-1.5 pr-3">Taken</th>
                  <th scope="col" className="py-1.5 pr-3">Average</th>
                  <th scope="col" className="py-1.5">Not yet taken</th>
                </tr>
              </thead>
              <tbody>
                {item.quizProgress.map((quiz) => (
                  <tr key={quiz.sessionId} className="border-t-2 border-ink/20 align-top">
                    <td className="py-1.5 pr-3 font-semibold">{quiz.title}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {quiz.takenCount} of {quiz.assignedCount}
                    </td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {quiz.average === null ? "—" : `${quiz.average}%`}
                    </td>
                    <td className="py-1.5">
                      {quiz.notTaken.length === 0 ? (
                        <PixelBadge variant="success">Everyone finished</PixelBadge>
                      ) : (
                        <span className="break-words">
                          {quiz.notTaken.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </PixelCard>
  );
}

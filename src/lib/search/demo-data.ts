import type { SearchEntity, SearchRow } from "./types";

type DemoTeacherSeed = {
  id: string;
  username: string;
  email: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  createdAt: string;
};

type DemoStudentSeed = {
  id: string;
  teacherId: string;
  username: string;
  email: string;
  createdAt: string;
};

type DemoQuizSeed = {
  id: string;
  teacherId: string;
  title: string;
  status: "draft" | "ready" | "failed";
  questionCount: number;
  createdAt: string;
};

type DemoSessionSeed = {
  id: string;
  quizId: string;
  code: string;
};

type DemoParticipantSeed = {
  id: string;
  sessionId: string;
  username: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  joinedAt: string;
};

const TEACHER_SEEDS: readonly DemoTeacherSeed[] = [
  {
    id: "101",
    username: "msantos",
    email: "maria.santos@littleeinstein.edu",
    status: "approved",
    createdAt: "2026-01-08T08:00:00.000Z",
  },
  {
    id: "102",
    username: "jdelacruz",
    email: "juan.delacruz@littleeinstein.edu",
    status: "pending",
    createdAt: "2026-02-12T08:00:00.000Z",
  },
  {
    id: "103",
    username: "areyes",
    email: "ana.reyes@littleeinstein.edu",
    status: "approved",
    createdAt: "2026-03-05T08:00:00.000Z",
  },
];

const STUDENT_SEEDS: readonly DemoStudentSeed[] = ([
  ["demo-student-01", "101", "maria.santos", "maria.santos@student.edu", "2026-06-15"],
  ["demo-student-02", "101", "carlo.mendoza", "carlo.mendoza@student.edu", "2026-06-18"],
  ["demo-student-03", "101", "ana.reyes", "ana.reyes@student.edu", "2026-07-02"],
  ["demo-student-04", "101", "joshua.lim", "joshua.lim@student.edu", "2026-07-10"],
  ["demo-student-05", "101", "bea.villanueva", "bea.villanueva@student.edu", "2026-08-01"],
  ["demo-student-06", "102", "juan.delacruz", "juan.delacruz@student.edu", "2026-06-20"],
  ["demo-student-07", "102", "sofia.garcia", "sofia.garcia@student.edu", "2026-07-05"],
  ["demo-student-08", "102", "miguel.torres", "miguel.torres@student.edu", "2026-07-18"],
  ["demo-student-09", "102", "hannah.cruz", "hannah.cruz@student.edu", "2026-08-09"],
  ["demo-student-10", "103", "liam.navarro", "liam.navarro@student.edu", "2026-06-25"],
  ["demo-student-11", "103", "emma.dizon", "emma.dizon@student.edu", "2026-07-14"],
  ["demo-student-12", "103", "noah.pascual", "noah.pascual@student.edu", "2026-08-02"],
] as const).map(([id, teacherId, username, email, date]) => ({
  id,
  teacherId,
  username,
  email,
  createdAt: `${date}T09:00:00.000Z`,
}));

const QUIZ_SEEDS: readonly DemoQuizSeed[] = ([
  ["demo-quiz-01", "101", "General Knowledge Quiz", "ready", 20, "2026-09-01"],
  ["demo-quiz-02", "101", "Science Fundamentals", "ready", 15, "2026-09-02"],
  ["demo-quiz-03", "101", "Math Essentials", "ready", 18, "2026-09-03"],
  ["demo-quiz-04", "101", "English Vocabulary", "draft", 12, "2026-09-04"],
  ["demo-quiz-05", "101", "Filipino Culture Trivia", "failed", 12, "2026-09-05"],
  ["demo-quiz-06", "102", "Algebra Basics", "ready", 18, "2026-06-11"],
  ["demo-quiz-07", "102", "Chemistry Lab Safety", "draft", 8, "2026-07-21"],
  ["demo-quiz-08", "102", "World History", "ready", 22, "2026-08-30"],
  ["demo-quiz-09", "103", "Reading Comprehension", "ready", 14, "2026-09-08"],
  ["demo-quiz-10", "103", "Earth Science", "draft", 16, "2026-09-28"],
] as const).map(([id, teacherId, title, status, questionCount, date]) => ({
  id,
  teacherId,
  title,
  status,
  questionCount,
  createdAt: `${date}T08:00:00.000Z`,
}));

const SESSION_SEEDS: readonly DemoSessionSeed[] = [
  { id: "demo-session-01", quizId: "demo-quiz-01", code: "FMBFE4" },
  { id: "demo-session-02", quizId: "demo-quiz-02", code: "UUZTUE" },
  { id: "demo-session-03", quizId: "demo-quiz-03", code: "EJXVF9" },
  { id: "demo-session-04", quizId: "demo-quiz-06", code: "WVHWN5" },
  { id: "demo-session-05", quizId: "demo-quiz-08", code: "HZ3K2P" },
  { id: "demo-session-06", quizId: "demo-quiz-09", code: "QJ7R4M" },
];

const PARTICIPANT_SEEDS: readonly DemoParticipantSeed[] = ([
  ["demo-participant-01", "demo-session-01", "maria.santos", "completed", 92, "2026-09-10"],
  ["demo-participant-02", "demo-session-01", "carlo.mendoza", "completed", 78, "2026-09-10"],
  ["demo-participant-03", "demo-session-01", "guest_star", "completed", 55, "2026-09-10"],
  ["demo-participant-04", "demo-session-02", "joshua.lim", "completed", 84, "2026-09-14"],
  ["demo-participant-05", "demo-session-02", "bea.villanueva", "in_progress", null, "2026-09-16"],
  ["demo-participant-06", "demo-session-03", "ana.reyes", "completed", 64, "2026-09-20"],
  ["demo-participant-07", "demo-session-03", "guest_echo", "in_progress", null, "2026-09-20"],
  ["demo-participant-08", "demo-session-04", "juan.delacruz", "completed", 81, "2026-09-22"],
  ["demo-participant-09", "demo-session-04", "sofia.garcia", "completed", 95, "2026-09-22"],
  ["demo-participant-10", "demo-session-05", "miguel.torres", "not_started", null, "2026-09-25"],
  ["demo-participant-11", "demo-session-05", "hannah.cruz", "completed", 73, "2026-09-25"],
  ["demo-participant-12", "demo-session-06", "liam.navarro", "completed", 89, "2026-10-02"],
  ["demo-participant-13", "demo-session-06", "emma.dizon", "completed", 91, "2026-10-02"],
  ["demo-participant-14", "demo-session-06", "noah.pascual", "in_progress", null, "2026-10-03"],
  ["demo-participant-15", "demo-session-06", "guest_guest", "not_started", null, "2026-10-04"],
] as const).map(([id, sessionId, username, status, score, date]) => ({
  id,
  sessionId,
  username,
  status,
  score,
  joinedAt: `${date}T09:00:00.000Z`,
}));

function teacherRows(): SearchRow[] {
  return TEACHER_SEEDS.map((teacher) => ({
    teacher_id: teacher.id,
    username: teacher.username,
    email: teacher.email,
    status: teacher.status,
    quiz_count: QUIZ_SEEDS.filter((quiz) => quiz.teacherId === teacher.id)
      .length,
    created_at: teacher.createdAt,
  }));
}

export function createDemoRows(input: {
  role: "teacher" | "admin";
  teacherId: string | null;
  teacherUsername: string | null;
}): Record<SearchEntity, SearchRow[]> {
  const scoped = input.role === "teacher" && input.teacherId;
  const activeTeacherId = scoped ? input.teacherId : "101";
  const teacherNameById = new Map(
    TEACHER_SEEDS.map((teacher) => [
      teacher.id,
      teacher.id === "101" && input.role === "teacher" && input.teacherUsername
        ? input.teacherUsername
        : teacher.username,
    ]),
  );
  const teacherIdFor = (teacherId: string) =>
    teacherId === "101" ? activeTeacherId : teacherId;

  const studentAccounts: SearchRow[] = STUDENT_SEEDS.map((student) => ({
    student_id: student.id,
    teacher_id: teacherIdFor(student.teacherId),
    teacher_username: teacherNameById.get(student.teacherId) ?? "",
    username: student.username,
    email: student.email,
    created_at: student.createdAt,
  }));

  const quizzes: SearchRow[] = QUIZ_SEEDS.map((quiz) => ({
    quiz_id: quiz.id,
    teacher_id: teacherIdFor(quiz.teacherId),
    teacher_username: teacherNameById.get(quiz.teacherId) ?? "",
    title: quiz.title,
    status: quiz.status,
    question_count: quiz.questionCount,
    created_at: quiz.createdAt,
  }));

  const sessionsById = new Map(
    SESSION_SEEDS.map((session) => [session.id, session]),
  );
  const quizzesById = new Map(QUIZ_SEEDS.map((quiz) => [quiz.id, quiz]));
  const studentsByUsername = new Map(
    STUDENT_SEEDS.map((student) => [student.username, student]),
  );

  const participants: SearchRow[] = PARTICIPANT_SEEDS.flatMap(
    (participant) => {
      const session = sessionsById.get(participant.sessionId);
      const quiz = session ? quizzesById.get(session.quizId) : undefined;

      if (!session || !quiz) {
        return [];
      }

      return [
        {
          participant_id: participant.id,
          session_id: participant.sessionId,
          session_code: session.code,
          quiz_id: quiz.id,
          quiz_title: quiz.title,
          username: participant.username,
          status: participant.status,
          score: participant.score,
          joined_at: participant.joinedAt,
          student_email:
            studentsByUsername.get(participant.username)?.email ?? "",
          teacher_id: teacherIdFor(quiz.teacherId),
          teacher_username: teacherNameById.get(quiz.teacherId) ?? "",
        },
      ];
    },
  );

  return {
    students: participants,
    student_accounts: studentAccounts,
    quizzes,
    teachers: teacherRows(),
  };
}

# Quiz Engine

## Data model

Academy uses MongoDB, so the quiz data lives in these collections:

- `quizzes`: one evaluation per course/education track.
- `quiz_questions`: question text, explanation, difficulty, position, and active state.
- `quiz_options`: four options per question; `is_correct` is read only by the backend and admin routes.
- `quiz_attempts`: immutable course/quiz metadata, randomized private question snapshots, score, status, and attempt number.
- `quiz_attempt_answers`: one server-graded answer per question and attempt.
- `course_progress`: completed lesson IDs plus `content_completed`, `quiz_passed`, and final `completed` state per user/course.

The idempotent migration in `backend/migrations/quiz_engine_v1.py` creates the
indexes and seeds the 10-question Fundamentos demo. It runs through the existing
application bootstrap and never overwrites an existing course quiz.

## Security guarantees

- Member and admin access reuse the existing JWT, membership, CSRF, RBAC, and admin 2FA dependencies.
- User identity always comes from the authenticated session.
- Active-question responses omit `correct_option_id`, `is_correct`, and explanations.
- Answer ownership, question order, option membership, duplicate answers, and scoring are enforced server-side.
- A unique partial index allows only one in-progress attempt per user and quiz.
- Attempts retain a private server snapshot so an admin edit cannot change an attempt already in progress.

## Local verification

Configure `backend/.env` from `backend/.env.example`, then run:

```bash
(cd backend && uvicorn server:app --reload --port 8000)
VITE_BACKEND_URL=http://localhost:8000 npm --prefix frontend run start
python -m unittest backend.tests.test_quiz_domain_unittest -v
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

No new environment variables are required.

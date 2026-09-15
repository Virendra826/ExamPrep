-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CONCEPT', 'PYQ');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('PDF', 'MANUAL');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'EXTRACTED', 'FAILED', 'REVIEWED');

-- CreateEnum
CREATE TYPE "QuestionTypeFilter" AS ENUM ('CONCEPT', 'PYQ', 'BOTH');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('SEQUENTIAL', 'RANDOM');

-- CreateEnum
CREATE TYPE "TimerMode" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'STARTED', 'IN_PROGRESS', 'TIMEOUT', 'SUBMITTED', 'EVALUATED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "subject_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "source" "QuestionSource" NOT NULL,
    "exam_name" TEXT,
    "exam_year" INTEGER,
    "difficulty" "Difficulty",
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "ingestion_batch_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_batches" (
    "id" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "source_type" "QuestionSource" NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_key" TEXT,
    "status" "IngestionStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "chapter_id" TEXT,
    "question_type_filter" "QuestionTypeFilter" NOT NULL,
    "requested_count" INTEGER NOT NULL,
    "order_mode" "OrderMode" NOT NULL,
    "timer_mode" "TimerMode" NOT NULL,
    "timer_duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "quiz_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "time_taken_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submitted_answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "quiz_question_id" TEXT NOT NULL,
    "selected_option" TEXT,
    "is_correct" BOOLEAN,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submitted_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "attempted_count" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "incorrect_count" INTEGER NOT NULL,
    "unattempted_count" INTEGER NOT NULL,
    "marks_obtained" DOUBLE PRECISION NOT NULL,
    "total_marks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "time_taken_seconds" INTEGER NOT NULL,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_subject_id_name_key" ON "chapters"("subject_id", "name");

-- CreateIndex
CREATE INDEX "questions_subject_id_chapter_id_question_type_status_idx" ON "questions"("subject_id", "chapter_id", "question_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_id_question_id_key" ON "quiz_questions"("quiz_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_questions_quiz_id_display_order_key" ON "quiz_questions"("quiz_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "submitted_answers_attempt_id_quiz_question_id_key" ON "submitted_answers"("attempt_id", "quiz_question_id");

-- CreateIndex
CREATE UNIQUE INDEX "results_attempt_id_key" ON "results"("attempt_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_ingestion_batch_id_fkey" FOREIGN KEY ("ingestion_batch_id") REFERENCES "ingestion_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_batches" ADD CONSTRAINT "ingestion_batches_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submitted_answers" ADD CONSTRAINT "submitted_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submitted_answers" ADD CONSTRAINT "submitted_answers_quiz_question_id_fkey" FOREIGN KEY ("quiz_question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "quiz_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

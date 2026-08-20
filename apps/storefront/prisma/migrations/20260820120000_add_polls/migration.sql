-- CreateEnum
CREATE TYPE "PollVisibility" AS ENUM ('PUBLIC', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "PollQuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'RATING');

-- CreateEnum
CREATE TYPE "PollResultsVisibility" AS ENUM ('HIDDEN', 'AFTER_VOTE', 'ALWAYS');

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "accentColor" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "PollVisibility" NOT NULL DEFAULT 'PUBLIC',
    "accessCode" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "resultsVisibility" "PollResultsVisibility" NOT NULL DEFAULT 'AFTER_VOTE',
    "allowMultipleSubmissions" BOOLEAN NOT NULL DEFAULT false,
    "collectEmail" BOOLEAN NOT NULL DEFAULT false,
    "consentNotice" TEXT,
    "thankYouMessage" TEXT,
    "closedMessage" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_questions" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "PollQuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "prompt" TEXT NOT NULL,
    "helpText" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "maxLength" INTEGER NOT NULL DEFAULT 1500,
    "placeholder" TEXT,
    "minSelections" INTEGER,
    "maxSelections" INTEGER,
    "allowOther" BOOLEAN NOT NULL DEFAULT false,
    "ratingMax" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "emoji" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_responses" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "anonymousRequested" BOOLEAN NOT NULL DEFAULT false,
    "consentAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_answers" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "textValue" TEXT,
    "otherText" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "polls_slug_key" ON "polls"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "polls_accessCode_key" ON "polls"("accessCode");

-- CreateIndex
CREATE INDEX "polls_status_visibility_idx" ON "polls"("status", "visibility");

-- CreateIndex
CREATE INDEX "polls_status_featured_sortOrder_idx" ON "polls"("status", "featured", "sortOrder");

-- CreateIndex
CREATE INDEX "poll_questions_pollId_sortOrder_idx" ON "poll_questions"("pollId", "sortOrder");

-- CreateIndex
CREATE INDEX "poll_options_questionId_sortOrder_idx" ON "poll_options"("questionId", "sortOrder");

-- CreateIndex
CREATE INDEX "poll_responses_pollId_submittedAt_idx" ON "poll_responses"("pollId", "submittedAt");

-- CreateIndex
CREATE INDEX "poll_responses_pollId_ipHash_idx" ON "poll_responses"("pollId", "ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "poll_answers_responseId_questionId_key" ON "poll_answers"("responseId", "questionId");

-- CreateIndex
CREATE INDEX "poll_answers_questionId_idx" ON "poll_answers"("questionId");

-- AddForeignKey
ALTER TABLE "poll_questions" ADD CONSTRAINT "poll_questions_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "poll_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "poll_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_answers" ADD CONSTRAINT "poll_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "poll_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

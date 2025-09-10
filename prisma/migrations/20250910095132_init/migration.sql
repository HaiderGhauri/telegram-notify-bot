-- CreateEnum
CREATE TYPE "public"."MentionStatus" AS ENUM ('PENDING', 'NOTIFIED', 'REPLIED');

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Mention" (
    "id" SERIAL NOT NULL,
    "status" "public"."MentionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    "memberId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InternalGroup" (
    "id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_MemberInternalGroups" (
    "A" BIGINT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_MemberInternalGroups_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_telegramId_key" ON "public"."Group"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_telegramId_key" ON "public"."Member"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_username_key" ON "public"."Member"("username");

-- CreateIndex
CREATE INDEX "_MemberInternalGroups_B_index" ON "public"."_MemberInternalGroups"("B");

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_MemberInternalGroups" ADD CONSTRAINT "_MemberInternalGroups_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."InternalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_MemberInternalGroups" ADD CONSTRAINT "_MemberInternalGroups_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

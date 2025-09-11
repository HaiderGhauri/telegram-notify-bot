-- DropForeignKey
ALTER TABLE "public"."Mention" DROP CONSTRAINT "Mention_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Mention" DROP CONSTRAINT "Mention_memberId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Mention" ADD CONSTRAINT "Mention_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

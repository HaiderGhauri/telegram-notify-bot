import type { Telegraf } from "telegraf";
import prisma from "../db.js";

export const mentionListener = (bot: Telegraf<any>) => {
  bot.on("text", async (ctx) => {
    console.log(ctx.message);
    const message = ctx.message;
    const chatId = message.chat.id;
    const userId = message.from.id;

    // Check if this group is tracked
    const group = await prisma.group.findUnique({
      where: { telegramId: BigInt(chatId) },
    });
    if (!group) return;

    // 1️⃣ Check if any PENDING or NOTIFIED mentions exist for this member in this group
    const mention = await prisma.mention.findFirst({
      where: {
        groupId: group.id, // Int DB ID
        member: { telegramId: BigInt(userId) }, // match by telegramId
        status: { in: ["PENDING", "NOTIFIED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (mention) {
      // 2️⃣ Update mention as REPLIED
      await prisma.mention.update({
        where: { id: mention.id },
        data: { status: "REPLIED", repliedAt: new Date() },
      });

      console.log(
        `Member ${
          ctx.message.from.username || ctx.message.from.first_name
        } replied ✅`
      );
    }

    // 3️⃣ Check if any tracked member is mentioned in this message
    if (message.entities) {
      for (const ent of message.entities) {
        let member;

        // Case A: Telegram provides full user object
        if (ent.type === "text_mention" && ent.user) {
          member = await prisma.member.findUnique({
            where: { telegramId: BigInt(ent.user.id) },
          });
        }
        // Case B: Only @username text available
        else if (ent.type === "mention") {
          const username = message.text
            .slice(ent.offset, ent.offset + ent.length)
            .replace(/^@/, "");
          member = await prisma.member.findUnique({
            where: { username },
          });
        }

        // If tracked member found → insert mention in DB
        if (member) {
          const existing = await prisma.mention.findFirst({
            where: {
              memberId: member.id, // Int (DB PK)
              groupId: group.id,
              status: { in: ["PENDING", "NOTIFIED"] },
            },
          });

          if (!existing) {
            await prisma.mention.create({
              data: {
                groupId: group.id,
                memberId: member.id,
                status: "PENDING",
              },
            });
          }
        }
      }
    }
  });
};

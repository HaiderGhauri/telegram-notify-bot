import type { Telegraf } from "telegraf";
import prisma from "../db.js";

export const mentionListener = (bot: Telegraf<any>) => {
  bot.on("text", async (ctx) => {
    const message = ctx.message;
    const chatId = message.chat.id;
    const userId = message.from.id;

    // 🔹 Check if this group is tracked
    const group = await prisma.group.findUnique({
      where: { telegramId: BigInt(chatId) },
    });
    if (!group) return;

    // 🔹 If sender is replying to someone → check target user
    if (message.reply_to_message && message.reply_to_message.from) {
      const repliedUser = message.reply_to_message.from;

      const member = await prisma.member.findUnique({
        where: { telegramId: BigInt(repliedUser.id) },
      });

      if (member) {
        // ensure no duplicate active mention already exists
        const existing = await prisma.mention.findFirst({
          where: {
            memberId: member.id,
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

          console.log(
            `📌 Reply mention detected → ${ctx.from.username || ctx.from.first_name
            } replied to ${repliedUser.username || repliedUser.first_name}`
          );
        }
      }
    }

    // 🔹 Check if any PENDING/NOTIFIED mentions exist for this member in this group
    const mention = await prisma.mention.findFirst({
      where: {
        groupId: group.id, // Int DB ID
        member: { telegramId: BigInt(userId) }, // match by telegramId
        status: { in: ["PENDING", "NOTIFIED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (mention) {
      // Mark mention as REPLIED
      await prisma.mention.update({
        where: { id: mention.id },
        data: { status: "REPLIED", repliedAt: new Date() },
      });

      console.log(
        `✅ Member ${ctx.message.from.username || ctx.message.from.first_name
        } replied`
      );
    }

    // 🔹 Detect explicit mentions in message entities
    if (message.entities) {
      for (const ent of message.entities) {
        let member;

        // Case A: text_mention (full user object)
        if (ent.type === "text_mention" && ent.user) {
          member = await prisma.member.findUnique({
            where: { telegramId: BigInt(ent.user.id) },
          });
        }
        // Case B: plain @username
        else if (ent.type === "mention") {
          const username = message.text
            .slice(ent.offset, ent.offset + ent.length)
            .replace(/^@/, "");
          member = await prisma.member.findUnique({
            where: { username },
          });
        }

        if (member) {
          const existing = await prisma.mention.findFirst({
            where: {
              memberId: member.id,
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

            console.log(
              `📌 Explicit mention detected → ${ctx.from.username || ctx.from.first_name
              } mentioned ${member.username}`
            );
          }
        }
      }
    }
  });
};

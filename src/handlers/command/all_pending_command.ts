import type { Telegraf } from "telegraf";
import prisma from "../../db.js";
import { OWNER_ID } from "../../bot.js";

export const allPendingCommand = (bot: Telegraf<any>) => {
  bot.command("all_pending", async (ctx) => {
    try {
      const userId = BigInt(ctx.message.from.id);

      // ✅ Only owner allowed
      if (userId !== OWNER_ID) {
        await ctx.reply("❌ You are not authorized to use this command.");
        return;
      }

      const chat = ctx.message.chat;

      // ✅ Check if this group is registered as internal
      const internalGroup = await prisma.internalGroup.findUnique({
        where: { id: BigInt(chat.id) },
      });

      if (!internalGroup) {
        await ctx.reply(
          "⚠️ This group is not registered as an internal group."
        );
        return;
      }

      // ✅ Fetch mentions (PENDING + NOTIFIED) for members of this internal group
      const mentions = await prisma.mention.findMany({
        where: {
          status: { in: ["PENDING", "NOTIFIED"] },
          member: {
            internalGroups: { some: { id: internalGroup.id } },
          },
        },
        include: { member: true, group: true },
        orderBy: { createdAt: "asc" },
      });

      if (mentions.length === 0) {
        await ctx.reply("✅ No pending or notified mentions found.");
        return;
      }

      // ✅ Build formatted message
      let messageText = `⚠️ Pending/Notified mentions in this group:\n\n`;

      mentions.forEach((mention, index) => {
        const member = mention.member;
        const username = member.username || "Unknown";

        messageText += `${index + 1}. <a href="tg://user?id=${
          member.telegramId
        }">${username}</a> you were mentioned in <b>${
          mention.group.name
        }</b>\n\n`;
      });

      await ctx.reply(messageText, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Something went wrong while fetching mentions.");
    }
  });
};

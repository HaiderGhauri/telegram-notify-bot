import type { Telegraf } from "telegraf";
import prisma from "../../db.js";
import { OWNER_ID } from "../../bot.js";

export const registerInternalCommand = (bot: Telegraf<any>) => {
  bot.command("register_internal", async (ctx) => {
    const chat = ctx.message.chat;
    const chatTitle =
      "title" in chat && chat.title ? chat.title : "Unnamed Group";
    try {
      const userId = BigInt(ctx.message.from.id);

      if (userId !== OWNER_ID) {
        await ctx.reply("❌ You are not authorized to use this command.");
        return;
      }

      if (!chatTitle) {
        await ctx.reply(
          "⚠️ Cannot register private chat. Please use a group chat."
        );
        return;
      }

      // Check if internal group already exists
      const existing = await prisma.internalGroup.findUnique({
        where: { id: BigInt(chat.id) },
      });

      if (existing) {
        await ctx.reply(
          "ℹ️ This group is already registered as an internal group."
        );
        return;
      }

      // Create new internal group
      await prisma.internalGroup.create({
        data: {
          id: BigInt(chat.id),
          name: chatTitle,
        },
      });

      await ctx.reply(
        `✅ <b>Internal group '<i>${chatTitle}</i>'</b> registered successfully!`,
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Something went wrong while registering the group.");
    }
  });
};

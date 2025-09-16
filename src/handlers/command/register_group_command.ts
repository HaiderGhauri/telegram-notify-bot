import type { Telegraf } from "telegraf";
import prisma from "../../db.js";
import { OWNER_ID } from "../../bot.js";

export const registerGroupCommand = (bot: Telegraf<any>) => {
    bot.command("register_group", async (ctx) => {
  const userId = BigInt(ctx.message.from.id);

  if (userId !== OWNER_ID) {
    await ctx.reply("❌ You are not authorized to use this command.");
    return;
  }

  const chat = ctx.message.chat;
  const chatId = BigInt(chat.id);

  const chatTitle =
    "title" in chat && chat.title ? chat.title : "Unnamed Group";

  // Check if group is already registered
  const existingGroup = await prisma.group.findUnique({
    where: { telegramId: chatId },
  });

  if (existingGroup) {
    await ctx.reply(
      `ℹ️ <b>This group "<i>${chatTitle}</i>"</b> is already registered.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  // Add new group to DB
  await prisma.group.create({
    data: {
      telegramId: chatId,
      name: chatTitle || "Unnamed Group",
    },
  });

  // await ctx.reply(
  //   `✅ <b>Group "<i>${chatTitle}</i>"</b> registered successfully!`,
  //   { parse_mode: "HTML" }
  // );
  console.log(`Group registered: ${chatTitle} [${chat.id}] by owner.`);
});
}
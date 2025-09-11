import type { Telegraf } from "telegraf";
import { OWNER_ID } from "../../bot.js";

export const initCommand = (bot: Telegraf<any>) => {
  bot.command("init", async (ctx) => {
    const userId = BigInt(ctx.message.from.id);

    if (userId !== OWNER_ID) {
      await ctx.reply("❌ You are not authorized to use this command.");
      console.log(`❌ You are not authorized to use this command.`);
      return;
    }

    await ctx.reply("✅ Bot started successfully. Owner verified!");
    console.log(`Owner ${ctx.message.from.username} started the bot.`);
  });
};

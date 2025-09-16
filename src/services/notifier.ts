import prisma from "../db.js";
import { Telegraf, Markup } from "telegraf";

let bot: Telegraf<any>;
// Owner ID from environment variables
const OWNER_ID = BigInt(process.env.OWNER_ID!);

export const initNotifier = (botInstance: Telegraf<any>) => {
  bot = botInstance;
  startNotifier();
  setupActions();
};

const startNotifier = () => {
  console.log("Notifier service started ✅");

  setInterval(async () => {
    try {
      // 1️⃣ Find all PENDING or NOTIFIED mentions older than 20 min
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      // Testing → 3 min
      const threeMinuteAgo = new Date(Date.now() - 1 * 60 * 3000);

      const pendingMentions = await prisma.mention.findMany({
        where: {
          status: { in: ["PENDING", "NOTIFIED"] },
          createdAt: { lte: threeMinuteAgo },
        },
        include: {
          member: true,
          group: true,
        },
      });

      if (pendingMentions.length === 0) return;

      const internalGroups = await prisma.internalGroup.findMany();

      function renderMention(member: {
        telegramId: bigint | null;
        username: string | null;
      }) {
        if (member.telegramId) {
          return `<a href="tg://user?id=${member.telegramId}">${
            member.username || "User"
          }</a>`;
        } else if (member.username) {
          // fallback: clickable but no notification
          return `@${member.username}`;
        } else {
          return "Unknown User";
        }
      }

      for (const mention of pendingMentions) {
        for (const internalGroup of internalGroups) {
          const mentionText = renderMention(mention.member);

          let groupLink: string;
          try {
            groupLink = mention.group.name
              ? `https://t.me/${mention.group.name}`
              : await bot.telegram.exportChatInviteLink(
                  mention.group.telegramId.toString()
                );
          } catch {
            groupLink = mention.group.name;
          }

          await bot.telegram.sendMessage(
            internalGroup.id.toString(),
            `⚠️ ${mentionText} you were mentioned in <a href="${groupLink}"><b>${mention.group.name}</b></a> but did not reply in time.\n\nDid you reply?`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Yes",
                      callback_data: `mention_yes_${mention.id}`,
                    },
                    {
                      text: "❌ No",
                      callback_data: `mention_no_${mention.id}`,
                    },
                  ],
                ],
              },
            }
          );
        }

        // agar abhi tak sirf PENDING tha → NOTIFIED me update kar do
        if (mention.status === "PENDING") {
          await prisma.mention.update({
            where: { id: mention.id },
            data: { status: "NOTIFIED" },
          });
        }
      }
    } catch (err) {
      console.error("Notifier error:", err);
    }
  }, 60 * 3000); // every 1 minute
};

// 2️⃣ Setup actions for Yes/No clicks
const setupActions = () => {
  // YES clicked → update to REPLIED
  bot.action(/^mention_yes_(\d+)$/, async (ctx) => {
    try {
      const mentionId = Number(ctx.match[1]);
      const mention = await prisma.mention.findUnique({
        where: { id: mentionId },
        include: { member: true, group: true },
      });

      if (!mention) {
        return ctx.answerCbQuery("❌ Mention not found");
      }

      // 🔒 prevent double-processing
      if (mention.status === "REPLIED") {
        return ctx.answerCbQuery("✅ Already marked as replied", {
          show_alert: true,
        });
      }

      const clickerId = BigInt(ctx.from.id);
      const clickerUsername = ctx.from.username;

      const isAuthorized =
        (mention.member.telegramId !== null &&
          clickerId === mention.member.telegramId) ||
        (mention.member.username &&
          clickerUsername === mention.member.username) ||
        clickerId === OWNER_ID;

      if (!isAuthorized) {
        return ctx.answerCbQuery("❌ Not allowed", { show_alert: true });
      }

      // update DB
      await prisma.mention.update({
        where: { id: mentionId },
        data: { status: "REPLIED" },
      });

      await ctx.answerCbQuery("✅ Marked as replied");

      const memberText = mention.member.telegramId
        ? `<a href="tg://user?id=${mention.member.telegramId}">${
            mention.member.username || "User"
          }</a>`
        : mention.member.username
        ? `@${mention.member.username}`
        : "Unknown User";

      const groupLink = mention.group.name
        ? `https://t.me/${mention.group.name}`
        : await bot.telegram.exportChatInviteLink(
            mention.group.telegramId.toString()
          );

      // ✅ safe edit with try-catch
      try {
        await ctx.editMessageText(
          `✅ ${memberText} confirmed they replied in <a href="${groupLink}"><b>${mention.group.name}</b></a>.`,
          {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [] },
          }
        );
      } catch (err: any) {
        if (err.description?.includes("message is not modified")) {
          // ignore silently
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error("mention_yes error:", err);
    }
  });

  // NO clicked → keep as NOTIFIED, don’t change
  bot.action(/^mention_no_(\d+)$/, async (ctx) => {
    const mentionId = Number(ctx.match[1]);

    const mention = await prisma.mention.findUnique({
      where: { id: mentionId },
      include: { member: true },
    });

    if (!mention) {
      await ctx.answerCbQuery("❌ Mention not found");
      return;
    }

    const clickerId = BigInt(ctx.from.id);
    const clickerUsername = ctx.from.username;

    const isAuthorized =
      (mention.member.telegramId !== null &&
        clickerId === mention.member.telegramId) ||
      (mention.member.username &&
        clickerUsername === mention.member.username) ||
      clickerId === OWNER_ID;

    if (!isAuthorized) {
      await ctx.answerCbQuery("❌ You are not allowed to respond", {
        show_alert: true,
      });
      return;
    }

    // status stays NOTIFIED; user will be reminded later
    await ctx.answerCbQuery(
      "❌ Marked as not replied. You’ll be reminded again."
    );
    try {
      await ctx.editMessageText(
        "❌ You marked as not replied. Reminder will repeat.",
        {
          reply_markup: { inline_keyboard: [] },
        }
      );
    } catch (err: any) {
      if (err.description?.includes("message is not modified")) {
        // ignore silently
      } else {
        throw err;
      }
    }
  });
};

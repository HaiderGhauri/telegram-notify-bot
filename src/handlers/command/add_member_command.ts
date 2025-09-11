import type { Telegraf } from "telegraf";
import prisma from "../../db.js";
import { OWNER_ID } from "../../bot.js";

export const addMemberCommand = (bot: Telegraf<any>) => {
  bot.command("add_member", async (ctx) => {
    try {
      const ownerId = BigInt(ctx.message.from.id);

      if (ownerId !== OWNER_ID) {
        await ctx.reply("❌ You are not authorized to use this command.");
        return;
      }

      const chat = ctx.message.chat;

      // Make sure internal group exists
      const internalGroup = await prisma.internalGroup.findUnique({
        where: { id: BigInt(chat.id) },
      });

      if (!internalGroup) {
        await ctx.reply("⚠️ This group is not registered as internal.");
        return;
      }

      const entities = ctx.message.entities || [];
      const addedUsers: string[] = [];
      const skippedUsers: string[] = [];
      const pendingUsers: string[] = [];

      for (const ent of entities) {
        // ✅ Case 1: Proper mention (Telegram gives full user object)
        if (ent.type === "text_mention" && ent.user) {
          const user = ent.user;

          const existingMember = await prisma.member.findFirst({
            where: {
              telegramId: BigInt(user.id),
              internalGroups: { some: { id: internalGroup.id } },
            },
          });

          if (existingMember) {
            skippedUsers.push(user.username || user.first_name);
          } else {
            let member = await prisma.member.findUnique({
              where: { telegramId: BigInt(user.id) },
            });

            if (!member) {
              member = await prisma.member.create({
                data: {
                  telegramId: BigInt(user.id),
                  username: user.username ?? user.first_name,
                },
              });
            }

            await prisma.internalGroup.update({
              where: { id: internalGroup.id },
              data: { members: { connect: { id: member.id } } },
            });

            addedUsers.push(user.username || user.first_name);
          }
        }

        // ✅ Case 2: Plain @username (no user.id in update object)
        if (ent.type === "mention") {
          const username = ctx.message.text
            .slice(ent.offset, ent.offset + ent.length)
            .replace(/^@/, "");

          let member = await prisma.member.findUnique({
            where: { username },
          });

          if (!member) {
            // naye member create karo with null telegramId
            member = await prisma.member.create({
              data: {
                username,
                telegramId: null, // unknown for now
              },
            });

            // send verification request
            await ctx.reply(
              `👋 @${username}, please verify yourself by clicking below:`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "✅ Verify",
                        callback_data: `verify_${member.id}`,
                      },
                    ],
                  ],
                },
              }
            );

            // connect new member to group
            await prisma.internalGroup.update({
              where: { id: internalGroup.id },
              data: { members: { connect: { id: member.id } } },
            });

            pendingUsers.push(`${username} (verification pending)`);
          } else {
            // agar member already exists
            await prisma.internalGroup.update({
              where: { id: internalGroup.id },
              data: { members: { connect: { id: member.id } } },
            });

            if (member.telegramId) {
              // fully verified member → add
              addedUsers.push(username);
            } else {
              // member exists but not verified yet → re-send verify prompt
              await ctx.reply(
                `⚠️ @${username} already exists but not verified.\nPlease verify yourself:`,
                {
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "✅ Verify",
                          callback_data: `verify_${member.id}`,
                        },
                      ],
                    ],
                  },
                }
              );
              pendingUsers.push(`${username} (awaiting verification)`);
            }
          }
        }
      }

      let replyMsg = "";
      if (addedUsers.length > 0)
        replyMsg += `✅ <b>Added:</b> <i>${addedUsers.join(", ")}</i>\n`;
      if (skippedUsers.length > 0)
        replyMsg += `ℹ️ Already exists / skipped: <i>${skippedUsers.join(
          ", "
        )}</i>\n`;
      if (pendingUsers.length > 0)
        replyMsg += `⏳ Pending verification: <i>${pendingUsers.join(
          ", "
        )}</i>\n`;

      await ctx.reply(
        replyMsg.trim() ||
          "⚠️ Please mention at least one user with @ in the command.",
        { parse_mode: "HTML" }
      );
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Something went wrong while adding members.");
    }
  });

  // ✅ Callback handler for verification
  bot.action(/^verify_(\d+)$/, async (ctx) => {
    try {
      const match = ctx.match as RegExpMatchArray | undefined;
      const memberId = match ? Number(match[1]) : NaN;
      if (!memberId) {
        await ctx.answerCbQuery("⚠️ Invalid verification token.");
        return;
      }

      if (!ctx.from) {
        await ctx.answerCbQuery("⚠️ User info missing.");
        return;
      }

      const member = await prisma.member.findUnique({
        where: { id: memberId },
      });

      if (!member) {
        await ctx.answerCbQuery("⚠️ Member record not found.");
        return;
      }

      const clickerId = BigInt(ctx.from.id);
      const clickerUsername = ctx.from.username ?? null;

      const isOwner = clickerId === OWNER_ID;

      // usernames are case-insensitive, also allow if clicker has no username but DB username exists
      const isSameUsername =
        member.username &&
        clickerUsername &&
        member.username.toLowerCase() === clickerUsername.toLowerCase();

      // ✅ FIX: allow verification if telegramId is null (not verified yet) and this user clicked
      const isSelfVerifying = member.telegramId === null && isSameUsername;

      if (!isSelfVerifying && !isOwner) {
        await ctx.answerCbQuery(
          "❌ You are not allowed to verify this account.",
          {
            show_alert: true,
          }
        );
        return;
      }

      if (member.telegramId) {
        await ctx.answerCbQuery("✅ This user is already verified.");
        try {
          await ctx.editMessageText(
            `🎉 @${member.username} is already verified.`
          );
        } catch {}
        return;
      }

      await prisma.member.update({
        where: { id: memberId },
        data: { telegramId: clickerId },
      });

      await ctx.answerCbQuery("✅ Verified successfully!", {
        show_alert: true,
      });

      try {
        await ctx.editMessageText(`🎉 @${member.username} has been verified!`);
      } catch {}
    } catch (err) {
      console.error("verify handler error:", err);
      try {
        await ctx.answerCbQuery("❌ Something went wrong.");
      } catch {}
    }
  });
};

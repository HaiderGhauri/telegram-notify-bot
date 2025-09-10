import { Telegraf } from "telegraf";
import prisma from "./db.js";

// 1. Initialize bot
export const bot = new Telegraf(process.env.BOT_TOKEN!);

// Owner ID from environment variables
const OWNER_ID = BigInt(process.env.OWNER_ID!);

// ------------------- OWNER-ONLY START COMMAND -------------------
bot.command("start", async (ctx) => {
  const userId = BigInt(ctx.message.from.id);

  if (userId !== OWNER_ID) {
    await ctx.reply("❌ You are not authorized to use this command.");
    console.log(`❌ You are not authorized to use this command.`);
    return;
  }

  await ctx.reply("✅ Bot started successfully. Owner verified!");
  console.log(`Owner ${ctx.message.from.username} started the bot.`);
});
// -----------------------------------------------------------------

// ------------------- OWNER-ONLY REGISTER GROUP COMMAND -------------------
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

  await ctx.reply(
    `✅ <b>Group "<i>${chatTitle}</i>"</b> registered successfully!`,
    { parse_mode: "HTML" }
  );
  console.log(`Group registered: ${chatTitle} [${chat.id}] by owner.`);
});
// -----------------------------------------------------------------

// ------------------- /register-internal -------------------
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

    for (const ent of entities) {
      // ✅ Case 1: Proper mention (Telegram gives full user object)
      if (ent.type === "text_mention" && ent.user) {
        const user = ent.user;

        // Check if already in this group (by telegramId)
        const existingMember = await prisma.member.findFirst({
          where: {
            telegramId: BigInt(user.id),
            internalGroups: { some: { id: internalGroup.id } },
          },
        });

        if (existingMember) {
          skippedUsers.push(user.username || user.first_name);
        } else {
          // Ensure member exists in DB
          let member = await prisma.member.findUnique({
            where: { telegramId: BigInt(user.id) },
          });

          if (!member) {
            member = await prisma.member.create({
              data: {
                telegramId: BigInt(user.id), // save actual Telegram ID
                username: user.username ?? user.first_name,
              },
            });
          }

          // Connect to internal group
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
          // Create member with null telegramId
          member = await prisma.member.create({
            data: {
              username,
              telegramId: null, // Telegram ID unknown
            },
          });
        }

        // Connect to internal group
        await prisma.internalGroup.update({
          where: { id: internalGroup.id },
          data: { members: { connect: { id: member.id } } },
        });

        addedUsers.push(username);
      }
    }

    let replyMsg = "";
    if (addedUsers.length > 0)
      replyMsg += `✅ <b>Added: <i>${addedUsers.join(", ")}</i></b>\n`;
    if (skippedUsers.length > 0)
      replyMsg += `ℹ️ Already exists / skipped: <i>${skippedUsers.join(
        ", "
      )}</i>`;

    await ctx.reply(
      replyMsg.trim() ||
        "⚠️ Please mention at least one user with @ in the command.",
      { parse_mode: "HTML" } // parse_mode yahan pass karo
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Something went wrong while adding members.");
  }
});
// -----------------------------------------------------

// 2. Listen for messages
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

// 3. Start bot
// bot.launch();
console.log("Bot started ✅");

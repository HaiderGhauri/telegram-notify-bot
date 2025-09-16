import { Telegraf } from "telegraf";
import prisma from "./db.js";
import { initNotifier } from "./services/notifier.js";
import { initCommand } from "./handlers/command/init_command.js";
import { registerGroupCommand } from "./handlers/command/register_group_command.js";
import { registerInternalCommand } from "./handlers/command/register_internal_command.js";
import { addMemberCommand } from "./handlers/command/add_member_command.js";
import { mentionListener } from "./handlers/mentionListener.js";

// 1. Initialize bot
export const bot = new Telegraf(process.env.BOT_TOKEN!);

// Owner ID from environment variables
export const OWNER_ID = BigInt(process.env.OWNER_ID!);

// ------------------- OWNER-ONLY INIT COMMAND -------------------
initCommand(bot);
// -----------------------------------------------------------------

// ------------------- OWNER-ONLY REGISTER MERCHANT GROUP COMMAND -------------------
registerGroupCommand(bot);
// -----------------------------------------------------------------

// ------------------- OWNER-ONLY REGISTER INTERNAL GROUP COMMAND -------------------
registerInternalCommand(bot);
// -----------------------------------------------------------------

// ------------------- OWNER-ONLY ADD SUPPORT MEMBER COMMAND -------------------
addMemberCommand(bot);
// -----------------------------------------------------

// 2. Listen for messages
mentionListener(bot);

// 3. Start bot
bot.launch();

// 4. Start notifier
initNotifier(bot);
console.log("Bot started ✅");

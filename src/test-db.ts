// src/test-db.ts
import prisma from "./db.js";

async function test() {
  // Test Group table
  const groups = await prisma.group.findMany();
  console.log("Groups:", groups);

  // Test Member table
  const members = await prisma.member.findMany();
  console.log("Members:", members);

  // Test Mention table
  const mentions = await prisma.mention.findMany();
  console.log("Mentions:", mentions);
}

test()
  .then(() => {
    console.log("DB connection successful ✅");
    process.exit(0);
  })
  .catch((err) => {
    console.error("DB connection failed ❌", err);
    process.exit(1);
  });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.trigger.count();
  if (count === 0) {
    await prisma.trigger.create({
      data: {
        name: "Scheduled page audits",
        enabled: true,
        intervalMinutes: 24 * 60,
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean start - delete all existing services
  await prisma.service.deleteMany();

  const services = [
    {
      title: "Ветеринарный осмотр",
      description: "Профессиональная диагностика здоровья, вакцинация и консультация.",
      imageUrl: "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
    {
      title: "Груминг для собак",
      description: "Полный комплекс ухода: стрижка, мытьё, чистка ушей.",
      imageUrl: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
    {
      title: "Дрессировка (ОКД)",
      description: "Курс послушания для щенков и взрослых собак.",
      imageUrl: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
    {
      title: "Чистка аквариумов",
      description: "Обслуживание аквариумных систем и замена воды.",
      imageUrl: "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
    {
      title: "Зоогостиница 5*",
      description: "Комфортное проживание с видеонаблюдением 24/7.",
      imageUrl: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
    {
      title: "Зоофотосессия",
      description: "Студийная съемка питомцев, 10 фото в ретуши.",
      imageUrl: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800",
      metaobjectId: null,
    },
  ];

  // Insert services one by one (SQLite doesn't fully support createMany)
  for (const service of services) {
    await prisma.service.create({ data: service });
  }

  console.log(`✅ Seeded ${services.length} services`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

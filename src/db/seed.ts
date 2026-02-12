import { db } from "./index";
import { categories } from "./schema";

async function main() {
  console.log("🌱 Populando categorias...");

  const defaultCategories = [
    { name: "Alimentação", type: "expense", icon: "Utensils" },
    { name: "Transporte", type: "expense", icon: "Car" },
    { name: "Lazer", type: "expense", icon: "Palmtree" },
    { name: "Saúde", type: "expense", icon: "HeartPulse" },
    { name: "Salário", type: "income", icon: "Banknote" },
    { name: "Investimentos", type: "income", icon: "TrendingUp" },
  ] as const;

  for (const cat of defaultCategories) {
    await db.insert(categories).values({
      name: cat.name,
      type: cat.type,
      icon: cat.icon,
      userId: "paulo-admin", // Substituiremos pelo seu ID do Auth depois
    });
  }

  console.log("✅ Categorias inseridas com sucesso!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erro ao popular banco:", err);
  process.exit(1);
});
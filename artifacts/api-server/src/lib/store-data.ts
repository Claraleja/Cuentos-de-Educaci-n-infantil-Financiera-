import { and, eq } from "drizzle-orm";
import { db, booksTable, storeSettingsTable } from "@workspace/db";

export const DEFAULT_SETTINGS = {
  storeName: "Cuentos de Educación Financiera Infantil",
  logoUrl: "",
  heroBadge: "EDUCACIÓN FINANCIERA INFANTIL INTERACTIVA",
  heroTitle: "Aprender a elegir hoy para construir los sueños del mañana.",
  heroSubtitle:
    "Cuentos ilustrados para niños (de 6 a 10 años) y sus familias. Descubre historias interactivas donde los niños aprenden a ahorrar, diferenciar necesidades de deseos y tomar decisiones financieras conscientes junto a sus padres.",
  heroQuote:
    "Cuentos ilustrados + Actividades en familia + Guía para padres.",
  contactEmail: "",
  instagramUrl: "",
  facebookUrl: "",
};

export async function ensureStoreDefaults(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(storeSettingsTable)
      .values({ id: 1, ...DEFAULT_SETTINGS })
      .onConflictDoNothing();

    const [settings] = await tx
      .select({ initialBookSeeded: storeSettingsTable.initialBookSeeded })
      .from(storeSettingsTable)
      .where(eq(storeSettingsTable.id, 1))
      .limit(1);

    if (!settings || settings.initialBookSeeded) return;

    const [claimed] = await tx
      .update(storeSettingsTable)
      .set({ initialBookSeeded: true })
      .where(
        and(
          eq(storeSettingsTable.id, 1),
          eq(storeSettingsTable.initialBookSeeded, false),
        ),
      )
      .returning({ id: storeSettingsTable.id });

    if (!claimed) return;

    const [firstBook] = await tx.select({ id: booksTable.id }).from(booksTable).limit(1);
    if (firstBook) return;

    await tx.insert(booksTable).values({
      title: "El Mercado de los Deseos",
      subtitle:
        "Una aventura para aprender a elegir, ahorrar y cumplir nuestros sueños.",
      author: "Claricel Rodríguez Asien",
      shortDescription:
        "Una historia para explorar la diferencia entre necesidades y deseos.",
      description:
        "Acompaña a Aina Lucía y Anthony junto a Don Monedín en una aventura donde descubrirán el pasillo de las necesidades y el pasillo de los deseos. Incluye diario de decisiones, el semáforo de las compras y 8 actividades interactivas para realizar en familia.",
      recommendedAge: "6 a 10 años (Para leer en familia o en el aula)",
      pages: 30,
      priceEur: 0,
      priceUsd: 0,
      checkoutUrlEur: "",
      checkoutUrlUsd: "",
      coverImageUrl: "",
    });
  });
}
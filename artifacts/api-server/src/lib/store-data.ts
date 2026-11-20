import { and, eq } from "drizzle-orm";
import { db, booksTable, storeSettingsTable } from "@workspace/db";

export const DEFAULT_SETTINGS = {
  storeName: "Cuentos de Educación Financiera Infantil",
  logoUrl: "",
  heroBadge: "LIBRERÍA INFANTIL · CUENTOS Y LIBROS PARA COLOREAR",
  heroTitle: "Cuentos que enseñan. Libros para colorear y soñar.",
  heroSubtitle:
    "Cuentos ilustrados de educación financiera para niños de 6 a 10 años y libros para colorear para los más pequeños. Dos colecciones, una misma idea: aprender jugando, en familia.",
  heroQuote:
    "Cuentos ilustrados + Libros para colorear + Actividades en familia.",
  contactEmail: "",
  instagramUrl: "",
  facebookUrl: "",
};

// Textos del hero anteriores (solo cuentos). Si la tienda en vivo todavía los
// tiene, es porque nadie los personalizó: se actualizan solos a los nuevos.
// Si la dueña ya escribió sus propios textos, no se tocan.
const OLD_HERO = {
  heroBadge: "EDUCACIÓN FINANCIERA INFANTIL INTERACTIVA",
  heroTitle: "Aprender a elegir hoy para construir los sueños del mañana.",
  heroSubtitle:
    "Cuentos ilustrados para niños (de 6 a 10 años) y sus familias. Descubre historias interactivas donde los niños aprenden a ahorrar, diferenciar necesidades de deseos y tomar decisiones financieras conscientes junto a sus padres.",
  heroQuote:
    "Cuentos ilustrados + Actividades en familia + Guía para padres.",
};

type ColoringBookSeed = {
  title: string;
  subtitle: string;
  author: string;
  shortDescription: string;
  description: string;
  recommendedAge: string;
  pages: number;
  priceEur: number;
  priceUsd: number;
  coverImageUrl: string;
  digitalFileUrl: string;
};

const COLORING_AUTHOR = "Claricel Rodríguez Asien";
const COLORING_AGE = "3 a 8 años (para colorear en familia)";

// Los 9 libros para colorear + la serie completa. Son digitales: se compran
// sin dirección y se descargan tras el pago (flujo Tropipay / confirmación
// manual). Precio: $3 por libro, $19 la serie; en EUR el mismo número (3 € /
// 19 €) para que el selector EUR/USD no quede vacío. Los dos abecedarios
// llegan solo hasta la J: la descripción lo dice con honestidad.
export const COLORING_BOOKS: ColoringBookSeed[] = [
  {
    title: "Colorea la Navidad",
    subtitle: "Un libro para colorear con la magia de la Navidad.",
    author: COLORING_AUTHOR,
    shortDescription: "Árboles, regalos y personajes navideños para colorear en familia.",
    description:
      "12 dibujos navideños de línea gruesa y sencilla, pensados para que los más pequeños coloreen sin salirse y disfruten de la Navidad dibujando. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/navidad.jpg",
    digitalFileUrl: "/libros/navidad.pdf",
  },
  {
    title: "Colorea Bajo el Mar",
    subtitle: "Un libro para colorear bajo el mar.",
    author: COLORING_AUTHOR,
    shortDescription: "Peces, tortugas y tesoros del fondo del mar para colorear.",
    description:
      "12 dibujos del mundo marino de línea gruesa y sencilla: peces, tortugas, pulpos y corales para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/bajo-el-mar.jpg",
    digitalFileUrl: "/libros/bajo-el-mar.pdf",
  },
  {
    title: "Colorea los Animales Terrestres",
    subtitle: "Un libro para colorear con animales de la tierra.",
    author: COLORING_AUTHOR,
    shortDescription: "Leones, elefantes y amigos de la selva y la sabana para colorear.",
    description:
      "12 dibujos de animales terrestres de línea gruesa y sencilla para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/animales-terrestres.jpg",
    digitalFileUrl: "/libros/animales-terrestres.pdf",
  },
  {
    title: "Colorea el Capibara",
    subtitle: "Un libro para colorear con el capibara más simpático.",
    author: COLORING_AUTHOR,
    shortDescription: "El capibara y sus amigos en 12 dibujos para colorear.",
    description:
      "12 dibujos del capibara de línea gruesa y sencilla, en escenas tranquilas y divertidas para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/capibara.jpg",
    digitalFileUrl: "/libros/capibara.pdf",
  },
  {
    title: "Mi Abecedario Animal",
    subtitle: "Aprende las letras coloreando un animal por letra.",
    author: COLORING_AUTHOR,
    shortDescription: "De la A a la J: un animal por letra para colorear y aprender el abecedario.",
    description:
      "Un abecedario para colorear: cada letra trae su animal, de la A a la J. OJO: este libro llega solo hasta la J (Abeja, Ballena, Cocodrilo…). 12 páginas en total, de línea gruesa y sencilla. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/mi-abecedario-animal.jpg",
    digitalFileUrl: "/libros/mi-abecedario-animal.pdf",
  },
  {
    title: "My Animal Alphabet",
    subtitle: "Learn the letters by coloring one animal per letter.",
    author: COLORING_AUTHOR,
    shortDescription: "From A to J: one animal per letter to color and learn the alphabet in English.",
    description:
      "A coloring alphabet in English: each letter comes with its animal, from A to J. NOTE: this book only goes up to J (Ant, Bear, Cat…). 12 pages in total, with thick, simple lines. Color cover and thank-you back cover.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/my-animal-alphabet.jpg",
    digitalFileUrl: "/libros/my-animal-alphabet.pdf",
  },
  {
    title: "Colorea los Dinosaurios",
    subtitle: "Un libro para colorear con dinosaurios.",
    author: COLORING_AUTHOR,
    shortDescription: "Tiranosaurios, triceratops y volcanes en 12 dibujos para colorear.",
    description:
      "12 dibujos de dinosaurios de línea gruesa y sencilla para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/dinosaurios.jpg",
    digitalFileUrl: "/libros/dinosaurios.pdf",
  },
  {
    title: "Colorea los Camiones",
    subtitle: "Un libro para colorear con camiones y máquinas.",
    author: COLORING_AUTHOR,
    shortDescription: "Camiones, grúas y excavadoras en 12 dibujos para colorear.",
    description:
      "12 dibujos de camiones y máquinas de línea gruesa y sencilla para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/camiones.jpg",
    digitalFileUrl: "/libros/camiones.pdf",
  },
  {
    title: "Colorea el Ajolote",
    subtitle: "Un libro para colorear con el ajolote más tierno.",
    author: COLORING_AUTHOR,
    shortDescription: "El ajolote y su mundo acuático en 12 dibujos para colorear.",
    description:
      "12 dibujos del ajolote de línea gruesa y sencilla, en escenas dulces del fondo del agua para colorear en familia. Portada en color y contraportada con mensaje de agradecimiento.",
    recommendedAge: COLORING_AGE,
    pages: 12,
    priceEur: 3,
    priceUsd: 3,
    coverImageUrl: "/portadas/ajolote.jpg",
    digitalFileUrl: "/libros/ajolote.pdf",
  },
  {
    title: "Serie completa — 9 libros para colorear",
    subtitle: "Los 9 libros para colorear en una sola descarga.",
    author: COLORING_AUTHOR,
    shortDescription: "Navidad, mar, animales, capibara, abecedarios, dinosaurios, camiones y ajolote: 9 libros, 108 páginas.",
    description:
      "La serie completa de libros para colorear: Navidad, Bajo el Mar, Animales Terrestres, Capibara, Mi Abecedario Animal, My Animal Alphabet, Dinosaurios, Camiones y Ajolote. 9 libros de 12 páginas cada uno (108 páginas en total) en un solo archivo ZIP. Los dos abecedarios llegan solo hasta la J.",
    recommendedAge: COLORING_AGE,
    pages: 108,
    priceEur: 19,
    priceUsd: 19,
    coverImageUrl: "/portadas/serie-completa.jpg",
    digitalFileUrl: "/libros/serie-completa.zip",
  },
];

const CUENTOS_AUTHOR = "Claricel Rodríguez Asien y Tony Grille Perez";
const CUENTOS_AGE = "6 a 10 años (para leer en familia o en el aula)";

// Los 2 cuentos de educación financiera, a $5 USD / 5 € (decisión de claricel
// 2026-11-20). Son digitales: portada + interior en un solo PDF de 32 págs.
// que se descarga tras el pago. Coautor de los dos: Tony Grille Perez (el
// interior de ambos libros lo dice así; la portada de El Mercado decía Alina
// por error y claricel va a pasar la corregida con Tony).
export const CUENTOS: ColoringBookSeed[] = [
  {
    title: "El Mercado de los Deseos",
    subtitle: "Una aventura para aprender a elegir, ahorrar y cumplir nuestros sueños.",
    author: CUENTOS_AUTHOR,
    shortDescription: "Una historia para explorar la diferencia entre necesidades y deseos.",
    description:
      "Acompaña a Aina Lucía y Anthony junto a Don Monedín en una aventura donde descubrirán el pasillo de las necesidades y el pasillo de los deseos. Incluye diario de decisiones, el semáforo de las compras y 8 actividades interactivas para realizar en familia.",
    recommendedAge: CUENTOS_AGE,
    pages: 32,
    priceEur: 5,
    priceUsd: 5,
    coverImageUrl: "/portadas/el-mercado-de-los-deseos.jpg",
    digitalFileUrl: "/libros/el-mercado-de-los-deseos.pdf",
  },
  {
    title: "La Aventura del Ahorro",
    subtitle: "El gran sueño de Aina Lucía",
    author: CUENTOS_AUTHOR,
    shortDescription: "Acompaña a Aina Lucía en una aventura donde cada moneda cuenta.",
    description:
      "Acompaña a Aina Lucía en una aventura donde cada moneda cuenta. A través de una historia divertida, ilustraciones llenas de color y actividades para completar en familia, los pequeños exploradores descubrirán cómo establecer metas, tomar decisiones y aprender a ahorrar paso a paso. Cuento ilustrado en 10 capítulos con 14 actividades imprimibles, mapa y registro de ahorro, diploma de explorador(a) y guía para acompañar la lectura.",
    recommendedAge: CUENTOS_AGE,
    pages: 32,
    priceEur: 5,
    priceUsd: 5,
    coverImageUrl: "/portadas/la-aventura-del-ahorro.jpg",
    digitalFileUrl: "/libros/la-aventura-del-ahorro.pdf",
  },
];

/**
 * Siembra los libros para colorear. Es idempotente y no depende de la bandera
 * `initialBookSeeded` (la base en vivo ya la tiene en true): busca cada libro
 * por título; si existe, actualiza sus datos; si no, lo crea. Así aparecen al
 * desplegar, sin tocar nada en /admin. Se ejecuta al arrancar.
 */
export async function ensureColoringBooks(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const seed of COLORING_BOOKS) {
      const [existing] = await tx
        .select({ id: booksTable.id })
        .from(booksTable)
        .where(eq(booksTable.title, seed.title))
        .limit(1);
      if (existing) {
        await tx
          .update(booksTable)
          .set({
            subtitle: seed.subtitle,
            author: seed.author,
            shortDescription: seed.shortDescription,
            description: seed.description,
            recommendedAge: seed.recommendedAge,
            pages: seed.pages,
            priceEur: seed.priceEur,
            priceUsd: seed.priceUsd,
            coverImageUrl: seed.coverImageUrl,
            category: "colorear",
            isDigital: true,
            digitalFileUrl: seed.digitalFileUrl,
          })
          .where(eq(booksTable.id, existing.id));
      } else {
        await tx.insert(booksTable).values({
          ...seed,
          category: "colorear",
          isDigital: true,
          checkoutUrlEur: "",
          checkoutUrlUsd: "",
          printProductUids: {},
          printFileUrl: "",
          printPageCount: 0,
        });
      }
    }
  });
}

/**
 * Igual que ensureColoringBooks pero para los cuentos de educación financiera
 * (categoría "cuento"). Actualiza El Mercado de los Deseos (ya existía en la
 * base con precio 0 y sin archivo) y crea La Aventura del Ahorro.
 */
export async function ensureCuentos(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const seed of CUENTOS) {
      const [existing] = await tx
        .select({ id: booksTable.id })
        .from(booksTable)
        .where(eq(booksTable.title, seed.title))
        .limit(1);
      if (existing) {
        await tx
          .update(booksTable)
          .set({
            subtitle: seed.subtitle,
            author: seed.author,
            shortDescription: seed.shortDescription,
            description: seed.description,
            recommendedAge: seed.recommendedAge,
            pages: seed.pages,
            priceEur: seed.priceEur,
            priceUsd: seed.priceUsd,
            coverImageUrl: seed.coverImageUrl,
            category: "cuento",
            isDigital: true,
            digitalFileUrl: seed.digitalFileUrl,
          })
          .where(eq(booksTable.id, existing.id));
      } else {
        await tx.insert(booksTable).values({
          ...seed,
          category: "cuento",
          isDigital: true,
          checkoutUrlEur: "",
          checkoutUrlUsd: "",
          printProductUids: {},
          printFileUrl: "",
          printPageCount: 0,
        });
      }
    }
  });
}

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

  // La tienda ya no es solo cuentos: si el hero todavía tiene los textos
  // viejos (nadie los personalizó en /admin), se actualiza a la presentación
  // de librería infantil con las dos colecciones. Si la dueña ya escribió los
  // suyos, no se toca nada.
  const [current] = await db
    .select({
      heroBadge: storeSettingsTable.heroBadge,
      heroTitle: storeSettingsTable.heroTitle,
      heroSubtitle: storeSettingsTable.heroSubtitle,
      heroQuote: storeSettingsTable.heroQuote,
    })
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, 1))
    .limit(1);
  if (
    current &&
    current.heroBadge === OLD_HERO.heroBadge &&
    current.heroTitle === OLD_HERO.heroTitle
  ) {
    await db
      .update(storeSettingsTable)
      .set({
        heroBadge: DEFAULT_SETTINGS.heroBadge,
        heroTitle: DEFAULT_SETTINGS.heroTitle,
        heroSubtitle: DEFAULT_SETTINGS.heroSubtitle,
        heroQuote: DEFAULT_SETTINGS.heroQuote,
      })
      .where(eq(storeSettingsTable.id, 1));
  }
}
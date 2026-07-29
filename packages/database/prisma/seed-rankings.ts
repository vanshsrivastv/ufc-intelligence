// Seeds real, current UFC divisional rankings (champion + ranked #1-15)
// for the 11 real divisions the Rankings page displays. import-dataset.ts
// never populates the Ranking table at all — this is what actually puts
// data behind that page. Source: ufc.com/rankings, current as of the time
// this file was written. Re-run this any time you want to refresh to a
// newer snapshot; it clears each division's prior rows first, so it's
// safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// rank 0 = champion, 1-15 = contenders, in order.
const RANKINGS: Record<string, string[]> = {
  Heavyweight: [
    "Tom Aspinall",
    "Ciryl Gane",
    "Alexander Volkov",
    "Sergei Pavlovich",
    "Josh Hokit",
    "Waldo Cortes Acosta",
    "Serghei Spivac",
    "Curtis Blaydes",
    "Rizvan Kuniev",
    "Ante Delija",
    "Valter Walker",
    "Tyrell Fortune",
    "Derrick Lewis",
    "Marcin Tybura",
    "Brando Pericic",
    "Mick Parkin",
  ],
  "Light Heavyweight": [
    "Carlos Ulberg",
    "Magomed Ankalaev",
    "Jiri Prochazka",
    "Alex Pereira",
    "Jan Blachowicz",
    "Khalil Rountree Jr.",
    "Paulo Costa",
    "Jamahal Hill",
    "Azamat Murzakanov",
    "Dominick Reyes",
    "Bogdan Guskov",
    "Robert Whittaker",
    "Johnny Walker",
    "Aleksandar Rakic",
    "Alonzo Menifield",
    "Navajo Stirling",
  ],
  Middleweight: [
    "Sean Strickland",
    "Khamzat Chimaev",
    "Dricus Du Plessis",
    "Nassourdine Imavov",
    "Brendan Allen",
    "Caio Borralho",
    "Anthony Hernandez",
    "Joe Pyfer",
    "Israel Adesanya",
    "Reinier de Ridder",
    "Christian Leroy Duncan",
    "Gregory Rodrigues",
    "Jared Cannonier",
    "Ikram Aliskerov",
    "Bo Nickal",
    "Roman Dolidze",
  ],
  Welterweight: [
    "Islam Makhachev",
    "Ian Machado Garry",
    "Carlos Prates",
    "Michael Morales",
    "Jack Della Maddalena",
    "Gabriel Bonfim",
    "Sean Brady",
    "Belal Muhammad",
    "Leon Edwards",
    "Kamaru Usman",
    "Joaquin Buckley",
    "Yaroslav Amosov",
    "Mike Malott",
    "Michael Page",
    "Uros Medic",
    "Daniel Rodriguez",
  ],
  Lightweight: [
    "Justin Gaethje",
    "Ilia Topuria",
    "Arman Tsarukyan",
    "Charles Oliveira",
    "Max Holloway",
    "Paddy Pimblett",
    "Benoit Saint Denis",
    "Mauricio Ruffy",
    "Mateusz Gamrot",
    "Dan Hooker",
    "Renato Moicano",
    "Rafael Fiziev",
    "Quillan Salkilld",
    "Tom Nolan",
    "Beneil Dariush",
    "Manuel Torres",
  ],
  Featherweight: [
    "Alexander Volkanovski",
    "Movsar Evloev",
    "Diego Lopes",
    "Lerone Murphy",
    "Aljamain Sterling",
    "Yair Rodriguez",
    "Jean Silva",
    "Arnold Allen",
    "Youssef Zalal",
    "Kevin Vallejos",
    "Steve Garcia",
    "Brian Ortega",
    "Aaron Pico",
    "Melquizael Costa",
    "David Onama",
    "Patricio Pitbull",
  ],
  Bantamweight: [
    "Petr Yan",
    "Merab Dvalishvili",
    "Sean O'Malley",
    "Umar Nurmagomedov",
    "Mario Bautista",
    "Cory Sandhagen",
    "Song Yadong",
    "Aiemann Zahabi",
    "David Martinez",
    "Deiveson Figueiredo",
    "Marlon Vera",
    "Payton Talbott",
    "Raul Rosas Jr.",
    "Raoni Barcelos",
    "Farid Basharat",
    "Marcus McGhee",
  ],
  Flyweight: [
    "Joshua Van",
    "Alexandre Pantoja",
    "Manel Kape",
    "Brandon Royval",
    "Tatsuro Taira",
    "Kyoji Horiguchi",
    "Lone'er Kavanagh",
    "Asu Almabayev",
    "Amir Albazi",
    "Brandon Moreno",
    "Alex Perez",
    "Steve Erceg",
    "Tim Elliott",
    "Tagir Ulanbekov",
    "Ramazan Temirov",
    "Edgar Chairez",
  ],
  "Women's Bantamweight": [
    "Kayla Harrison",
    "Julianna Pena",
    "Raquel Pennington",
    "Joselyne Edwards",
    "Norma Dumont",
    "Ailin Perez",
    "Yana Santos",
    "Luana Santos",
    "Macy Chiasson",
    "Jacqueline Cavalcanti",
    "Karol Rosa",
    "Bia Mesquita",
    "Michelle Montague",
    "Nora Cornolle",
    "Miesha Tate",
    "Melissa Croden",
  ],
  "Women's Flyweight": [
    "Valentina Shevchenko",
    "Natalia Silva",
    "Manon Fiorot",
    "Alexa Grasso",
    "Erin Blanchfield",
    "Rose Namajunas",
    "Maycee Barber",
    "Jasmine Jasudavicius",
    "Wang Cong",
    "Tracy Cortez",
    "Miranda Maverick",
    "Karine Silva",
    "Casey O'Neill",
    "Eduarda Moura",
    "JJ Aldrich",
    "Gabriella Fernandes",
  ],
  "Women's Strawweight": [
    "Mackenzie Dern",
    "Zhang Weili",
    "Tatiana Suarez",
    "Virna Jandiroba",
    "Yan Xiaonan",
    "Gillian Robertson",
    "Fatima Kline",
    "Loopy Godinez",
    "Amanda Lemos",
    "Jessica Andrade",
    "Tabatha Ricci",
    "Amanda Ribas",
    "Alexia Thainara",
    "Denise Gomes",
    "Angela Hill",
    "Mizuki",
  ],
};

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents/diacritics
    .replace(/[^a-z0-9\s']/gi, "")
    .trim()
    .toLowerCase();
}

async function main() {
  console.log("Loading fighters for name matching...");
  const fighters = await prisma.fighter.findMany({
    select: { id: true, name: true },
  });
  const byNormalizedName = new Map(fighters.map((f) => [normalize(f.name), f.id]));

  const unmatched: string[] = [];
  const now = new Date();
  let totalSeeded = 0;

  for (const [divisionName, names] of Object.entries(RANKINGS)) {
    const weightClass = await prisma.weightClass.findFirst({
      where: { name: { equals: divisionName, mode: "insensitive" } },
    });

    if (!weightClass) {
      console.warn(`Skipping "${divisionName}" — no matching WeightClass row found.`);
      continue;
    }

    // Clear this division's prior rankings so re-running the script
    // doesn't pile up duplicate historical snapshots.
    await prisma.ranking.deleteMany({ where: { weightClassId: weightClass.id } });

    let seededInDivision = 0;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const fighterId = byNormalizedName.get(normalize(name));
      if (!fighterId) {
        unmatched.push(`${divisionName}: ${name}`);
        continue;
      }
      await prisma.ranking.create({
        data: {
          weightClassId: weightClass.id,
          fighterId,
          rank: i, // 0 = champion
          effectiveDate: now,
        },
      });
      seededInDivision++;
      totalSeeded++;
    }
    console.log(`${divisionName}: seeded ${seededInDivision}/${names.length}`);
  }

  console.log(`\nTotal ranking rows seeded: ${totalSeeded}`);
  if (unmatched.length > 0) {
    console.warn(
      `\n${unmatched.length} fighter(s) in the ranking list had no match in the imported dataset (likely not in the CSV, or a name-formatting difference):`,
    );
    unmatched.forEach((u) => console.warn(`  - ${u}`));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

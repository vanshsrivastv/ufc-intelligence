// Seeds real, current UFC divisional rankings (champion + ranked #1-15)
// for the 11 real divisions the Rankings page displays. import-dataset.ts
// never populates the Ranking table at all — this is what actually puts
// data behind that page. Source: ufc.com/rankings' "Media Panel Rankings"
// tab (not the "Meta" algorithmic tab, which is a different, newer
// ranking system ufc.com now also shows and orders divisions
// differently) - current as of the time this file was written. Re-run
// this any time you want to refresh to a newer snapshot; it clears each
// division's prior rows first, so it's safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// rank 0 = champion, 1-15 = contenders, in order.
// Snapshot: ufc.com/rankings, Media Panel Rankings, "Last updated: Tuesday, Oct. 6".
const RANKINGS: Record<string, string[]> = {
  Heavyweight: [
    "Ciryl Gane",
    "Tom Aspinall",
    "Alexander Volkov",
    "Sergei Pavlovich",
    "Josh Hokit",
    "Curtis Blaydes",
    "Waldo Cortes Acosta",
    "Rizvan Kuniev",
    "Vitor Petrino",
    "Serghei Spivac",
    "Ante Delija",
    "Valter Walker",
    "Tyrell Fortune",
    "Derrick Lewis",
    "Aleksandar Rakic",
    "Mario Pinto",
  ],
  "Light Heavyweight": [
    "Carlos Ulberg",
    "Magomed Ankalaev",
    "Jiri Prochazka",
    "Alex Pereira",
    "Khalil Rountree Jr.",
    "Navajo Stirling",
    "Paulo Costa",
    "Azamat Murzakanov",
    "Dominick Reyes",
    "Jan Blachowicz",
    "Bogdan Guskov",
    "Robert Whittaker",
    "Alonzo Menifield",
    "Muhammad Saidov", // not yet in our roster (not previously ranked) - will land in unmatched
    "Reinier de Ridder",
    "Nikita Krylov",
  ],
  Middleweight: [
    "Sean Strickland",
    "Khamzat Chimaev",
    "Dricus Du Plessis",
    "Nassourdine Imavov",
    "Brendan Allen",
    "Caio Borralho",
    "Joe Pyfer",
    "Gregory Rodrigues",
    "Anthony Hernandez",
    "Israel Adesanya",
    "Christian Leroy Duncan",
    "Jared Cannonier",
    "Abus Magomedov",
    "Ikram Aliskerov",
    "Bo Nickal",
    "Shara Magomedov",
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
    "Uros Medic",
    "Mike Malott",
    "Daniel Rodriguez",
    "Neil Magny",
  ],
  Lightweight: [
    "Justin Gaethje",
    "Ilia Topuria",
    "Arman Tsarukyan",
    "Charles Oliveira",
    "Max Holloway",
    "Paddy Pimblett",
    "Benoit Saint Denis",
    "Quillan Salkilld",
    "Mauricio Ruffy",
    "Salahdine Parnasse",
    "Mateusz Gamrot",
    "Rafael Fiziev",
    "Renato Moicano",
    "Dan Hooker",
    "Tom Nolan",
    "Beneil Dariush",
  ],
  Featherweight: [
    "Alexander Volkanovski",
    "Movsar Evloev",
    "Diego Lopes",
    "Lerone Murphy",
    "Aljamain Sterling",
    "Jean Silva",
    "Yair Rodriguez",
    "Arnold Allen",
    "Youssef Zalal",
    "Kevin Vallejos",
    "Steve Garcia",
    "Aaron Pico",
    "Melquizael Costa",
    "Brian Ortega",
    "Patricio Freire", // ufc.com lists him by ring name "Patricio Pitbull" - our roster has his real name
    "David Onama",
  ],
  Bantamweight: [
    "Petr Yan",
    "Merab Dvalishvili",
    "Sean O'Malley",
    "Song Yadong",
    "Umar Nurmagomedov",
    "Mario Bautista",
    "Cory Sandhagen",
    "Payton Talbott",
    "Aiemann Zahabi",
    "David Martinez",
    "Raul Rosas Jr.",
    "Marlon Vera",
    "Deiveson Figueiredo",
    "Farid Basharat",
    "Marcus McGhee",
    "Raoni Barcelos",
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
    "Brandon Moreno",
    "Amir Albazi",
    "Ramazan Temirov",
    "Tim Elliott",
    "Steve Erceg",
    "Sumudaerji",
    "Tagir Ulanbekov",
    "Alex Perez",
  ],
  "Women's Bantamweight": [
    "Kayla Harrison",
    "Julianna Pena",
    "Joselyne Edwards",
    "Ailin Perez",
    "Raquel Pennington",
    "Norma Dumont",
    "Yana Santos",
    "Luana Santos",
    "Jacqueline Cavalcanti",
    "Macy Chiasson",
    "Karol Rosa",
    "Bia Mesquita",
    "Michelle Montague",
    "Nora Cornolle",
    "Melissa Croden",
    "Daria Zhelezniakova",
  ],
  "Women's Flyweight": [
    "Natalia Silva",
    "Valentina Shevchenko",
    "Alexa Grasso",
    "Manon Fiorot",
    "Erin Blanchfield",
    "Rose Namajunas",
    "Jasmine Jasudavicius",
    "Maycee Barber",
    "Wang Cong",
    "Tracy Cortez",
    "Miranda Maverick",
    "Karine Silva",
    "Casey O'Neill",
    "Eduarda Moura",
    "Regina Tarin",
    "Gabriella Fernandes",
  ],
  "Women's Strawweight": [
    "Mackenzie Dern",
    "Zhang Weili",
    "Tatiana Suarez",
    "Virna Jandiroba",
    "Denise Gomes",
    "Gillian Robertson",
    "Yan Xiaonan",
    "Fatima Kline",
    "Loopy Godinez",
    "Alexia Thainara",
    "Jessica Andrade",
    "Tabatha Ricci",
    "Amanda Lemos",
    "Amanda Ribas",
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
    select: { id: true, name: true, weightClassId: true },
  });
  const byNormalizedName = new Map(fighters.map((f) => [normalize(f.name), f]));

  const unmatched: string[] = [];
  const now = new Date();
  let totalSeeded = 0;
  let totalReassigned = 0;

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
      const fighter = byNormalizedName.get(normalize(name));
      if (!fighter) {
        unmatched.push(`${divisionName}: ${name}`);
        continue;
      }
      await prisma.ranking.create({
        data: {
          weightClassId: weightClass.id,
          fighterId: fighter.id,
          rank: i, // 0 = champion
          effectiveDate: now,
        },
      });
      seededInDivision++;
      totalSeeded++;

      // The ranking list is the most current signal of which division a
      // fighter actually competes in - more current than whatever
      // weightClassId they were imported with, which is never touched
      // again after import. A fighter who moved divisions (e.g. a
      // lightweight champion moving up to challenge for a welterweight
      // title) would otherwise show the wrong division on their own
      // profile page forever, even though the rankings/homepage (which
      // read from this table) already show the right one.
      if (fighter.weightClassId !== weightClass.id) {
        await prisma.fighter.update({
          where: { id: fighter.id },
          data: { weightClassId: weightClass.id },
        });
        totalReassigned++;
        console.log(`  ~ reassigned "${name}" to ${divisionName} (weightClassId was stale)`);
      }
    }
    console.log(`${divisionName}: seeded ${seededInDivision}/${names.length}`);
  }

  console.log(`\nTotal ranking rows seeded: ${totalSeeded}`);
  console.log(`Total fighter weightClassId reassignments: ${totalReassigned}`);
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

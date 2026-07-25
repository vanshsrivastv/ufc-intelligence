import { Provider } from "@nestjs/common";
import { prisma } from "@ufc-intelligence/database";

export const PRISMA = Symbol("PRISMA");

export const PrismaProvider: Provider = {
  provide: PRISMA,
  useValue: prisma,
};

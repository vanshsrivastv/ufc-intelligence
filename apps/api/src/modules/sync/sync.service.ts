import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// packages/database/prisma/sync-results.ts fills in real fight results
// for events that have already happened, but - like every other data-
// pipeline script in this project - it only ever ran when someone
// remembered to run it by hand. That gap is exactly why a card that
// finished days ago sat showing every fight as "Scheduled" with no
// result: the script that fixes this existed the whole time, nothing
// was ever calling it automatically.
//
// This runs it on a timer for as long as the API process is alive.
// Shells out to the actual script (via the same `npm run` command a
// person would type) rather than importing its TS module directly -
// that module isn't part of this package's build output, and Nest's
// webpack build has already broken once importing something outside
// its expected bundle graph (see the Prisma query-engine issue
// elsewhere in this project's history). Shelling out sidesteps that
// class of problem entirely.
@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  onModuleInit() {
    // Fire-and-forget on startup so a freshly-started server catches up
    // immediately instead of waiting up to an hour for the first tick.
    void this.syncResults();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async syncResults() {
    if (this.running) {
      this.logger.warn("Skipping scheduled result sync - previous run is still in progress");
      return;
    }

    this.running = true;
    this.logger.log("Starting scheduled fight-result sync...");
    try {
      const { stdout, stderr } = await execAsync(
        "npm run --workspace=@ufc-intelligence/database sync-results",
        { maxBuffer: 10 * 1024 * 1024 },
      );
      if (stdout.trim()) this.logger.log(stdout.trim());
      if (stderr.trim()) this.logger.warn(stderr.trim());
    } catch (err) {
      this.logger.error(`Scheduled fight-result sync failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression, Interval } from "@nestjs/schedule";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

// Runs two data-pipeline scripts on a timer for as long as the API
// process is alive, both of which previously only ran when someone
// remembered to invoke them by hand - shells out to the actual `npm
// run` command for each rather than importing their TS modules
// directly, since those modules aren't part of this package's build
// output and Nest's webpack build has already broken once importing
// something outside its expected bundle graph (see the Prisma query-
// engine issue elsewhere in this project's history).
@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private syncRunning = false;
  private relinkRunning = false;

  onModuleInit() {
    // Fire-and-forget on startup so a freshly-started server catches up
    // immediately instead of waiting up to an hour for the first tick.
    // Deliberately NOT done for relinkStubFighters below - that one runs
    // on a 5-day cadence by request, and firing it on every restart
    // instead would badly outpace that on a machine that gets restarted
    // as often as this one has been.
    void this.syncResults();
  }

  // packages/database/prisma/sync-results.ts fills in real fight results
  // for events that have already happened - the gap that let a card
  // which finished days earlier sit showing every fight as "Scheduled"
  // with no result. compute-elo.ts runs right after, in the same tick,
  // for the same reason: it's a full recompute over every completed
  // fight, so it was silently going stale the moment sync-results
  // started running on its own schedule and nothing re-triggered it.
  // compute-elo.ts is a fast, local, no-network DB walk (no 15s crawl-
  // delay the way the scrapers have), so running it every hour
  // regardless of whether sync-results actually changed anything is
  // cheap - simpler than trying to detect "did anything change" first.
  @Cron(CronExpression.EVERY_HOUR)
  async syncResults() {
    if (this.syncRunning) {
      this.logger.warn("Skipping scheduled result sync - previous run is still in progress");
      return;
    }

    this.syncRunning = true;
    try {
      this.logger.log("Starting scheduled fight-result sync...");
      const { stdout, stderr } = await execAsync(
        "npm run --workspace=@ufc-intelligence/database sync-results",
        { maxBuffer: 10 * 1024 * 1024 },
      );
      if (stdout.trim()) this.logger.log(stdout.trim());
      if (stderr.trim()) this.logger.warn(stderr.trim());

      this.logger.log("Starting scheduled Elo recompute...");
      const elo = await execAsync("npm run --workspace=@ufc-intelligence/database compute-elo", {
        maxBuffer: 10 * 1024 * 1024,
      });
      if (elo.stdout.trim()) this.logger.log(elo.stdout.trim());
      if (elo.stderr.trim()) this.logger.warn(elo.stderr.trim());
    } catch (err) {
      this.logger.error(`Scheduled fight-result sync failed: ${(err as Error).message}`);
    } finally {
      this.syncRunning = false;
    }
  }

  // packages/database/prisma/relink-stub-fighters.ts corrects a fight
  // still linked to an empty stub fighter once ufc.com publishes a
  // fuller name for that bout - the gap that let most of an upcoming
  // card's undercard show 0-0 records. A 5-day cadence rather than
  // hourly: this only matters as a card gets closer and ufc.com fills in
  // names it hadn't announced yet, not something that changes hour to
  // hour the way a live result does.
  //
  // @Interval fires every 5 days from whenever the process started, not
  // from a calendar boundary - it resets on every restart, so on a
  // machine that gets restarted more often than every 5 days (this one
  // has, repeatedly, this session) it may not fire under its own timer
  // between restarts. Same "only runs while the process is alive and
  // hasn't been restarted first" caveat sync-results above already
  // carries, just more likely to bite at a 5-day cadence than an hourly
  // one - worth knowing rather than assuming this is a hard guarantee.
  @Interval(FIVE_DAYS_MS)
  async relinkStubFighters() {
    if (this.relinkRunning) {
      this.logger.warn("Skipping scheduled stub-fighter relink - previous run is still in progress");
      return;
    }

    this.relinkRunning = true;
    this.logger.log("Starting scheduled stub-fighter relink...");
    try {
      const { stdout, stderr } = await execAsync(
        "npm run --workspace=@ufc-intelligence/database relink-stub-fighters",
        { maxBuffer: 10 * 1024 * 1024 },
      );
      if (stdout.trim()) this.logger.log(stdout.trim());
      if (stderr.trim()) this.logger.warn(stderr.trim());
    } catch (err) {
      this.logger.error(`Scheduled stub-fighter relink failed: ${(err as Error).message}`);
    } finally {
      this.relinkRunning = false;
    }
  }
}

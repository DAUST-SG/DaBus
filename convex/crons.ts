import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Each trip sets its own minimum and cutoff; this is only how often we look.
// A trip is acted on within 15 minutes of its cutoff passing.
crons.interval("minimum seats check", { minutes: 15 }, internal.minSeats.check, {});

export default crons;

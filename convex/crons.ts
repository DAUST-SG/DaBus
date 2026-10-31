import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Each trip sets its own minimum and cutoff; this is only how often we look.
// A trip is acted on within 15 minutes of its cutoff passing.
crons.interval("minimum seats check", { minutes: 15 }, internal.minSeats.check, {});

// Retries ledger reports that failed temporarily; new ones are sent immediately
crons.interval("ledger retry", { minutes: 5 }, internal.ledger.flush, {});

// Completes trips nobody marked completed, a set time after departure (Settings)
crons.interval("auto-complete trips", { minutes: 15 }, internal.trips.autoComplete, {});

export default crons;

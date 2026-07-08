// Error types live in src/lib/errors.ts so both the shared pipeline (src/lib) and
// the worker can use them without a lib→worker dependency. Re-exported here for
// the worker's existing import paths.
export {
  ValidationRejected,
  InfraFault,
  classifyOutcome,
  type JobOutcome,
} from "@/lib/errors";

// Prepared for isolated preview. Not deployed.
import { createDirectorWakeHandler } from '../../../src/autopilot/directorWake.ts';

const handler = createDirectorWakeHandler({
  token: Deno.env.get('AUTOPILOT_DIRECTOR_WAKE_TOKEN'),
});

Deno.serve(handler);

import cron from 'node-cron';
import { runReorderCheck } from '../services/forecastService';

/**
 * Runs nightly at 2 AM. Velocity is a slower-moving signal than raw stock
 * level, so unlike the hourly low-stock check, this doesn't need to run
 * often — once a day is enough for the 30-day moving average to be
 * meaningful. Same story as lowStockCheck: in production this is the
 * function an EventBridge-scheduled Lambda calls, not this cron.
 */
export function startReorderCron(): void {
  cron.schedule('0 2 * * *', () => {
    runReorderCheck()
      .then(({ created, resolved }) => {
        if (created || resolved) {
          console.log(`[forecast] reorder check: ${created} created, ${resolved} resolved`);
        }
      })
      .catch((err) => console.error('[forecast] reorder check failed', err));
  });
  console.log('[forecast] reorder cron scheduled (nightly at 2 AM)');
}

import cron from 'node-cron';
import { runLowStockCheck } from '../services/alertService';

/**
 * Runs every hour. In production this maps directly onto an AWS Lambda
 * triggered by an EventBridge schedule instead of an in-process cron —
 * same function (`runLowStockCheck`), different trigger. Kept in-process
 * here so the whole thing runs with just `npm run dev` for local dev/demo.
 */
export function startLowStockCron(): void {
  cron.schedule('0 * * * *', () => {
    runLowStockCheck()
      .then(({ created, resolved }) => {
        if (created || resolved) {
          console.log(`[alerts] low-stock check: ${created} created, ${resolved} resolved`);
        }
      })
      .catch((err) => console.error('[alerts] low-stock check failed', err));
  });
  console.log('[alerts] low-stock cron scheduled (hourly)');
}

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const TW_API_KEY = process.env.TW_API_KEY || '71eb6140-1f29-46e0-bdc2-f3207e0f668e';
const TW_BASE = 'https://api.triplewhale.com/api/v2';
const SHOP = 'plasmaide-uk.myshopify.com';

// Replace with your Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function twPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const url = new URL(TW_BASE + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'x-api-key': TW_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = require('https').request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function getMetric(summary, id) {
  return summary.metrics?.find(m => m.id === id)?.values?.current ?? null;
}

async function syncDay(dateStr) {
  console.log(`Syncing ${dateStr}...`);

  // Call 1: Summary page — revenue, orders, daily chart
  const summary = await twPost('/summary-page/get-data', {
    shopDomain: SHOP,
    period: { start: dateStr, end: dateStr },
    todayHour: 25
  });

  // Call 2: Moby — AOV, new vs returning
  const moby = await twPost('/orcabase/api/moby', {
    shopId: SHOP,
    question: `What is my total revenue, total orders, AOV, new customer orders, new customer revenue, returning customer orders, and returning customer revenue on ${dateStr}?`
  });

  const answer = moby.responses?.[0];
  if (!answer || answer.isError) {
    console.warn(`Moby error for ${dateStr}:`, answer?.assistant);
  }

  const row = {
    shop_domain: SHOP,
    date: dateStr,
    revenue: getMetric(summary, 'sales'),
    orders: getMetric(summary, 'orders'),
    aov: answer?.answer?.aov?.[0] ?? null,
    new_customer_orders: answer?.answer?.new_customer_orders?.[0] ?? null,
    new_customer_revenue: answer?.answer?.new_customer_revenue?.[0] ?? null,
    returning_customer_orders: answer?.answer?.returning_customer_orders?.[0] ?? null,
    returning_customer_revenue: answer?.answer?.returning_customer_revenue?.[0] ?? null,
  };

  console.log('  Row:', row);

  const { error } = await supabase
    .from('tw_daily_summary')
    .upsert(row, { onConflict: 'shop_domain,date' });

  if (error) console.error('  Supabase error:', error);
  else console.log('  Upserted OK');
}

async function syncRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    await syncDay(dateStr);
    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
}

// Run: node sync-triple-whale.js [startDate] [endDate]
// e.g. node sync-triple-whale.js 2026-04-01 2026-04-19
// Default: yesterday
const args = process.argv.slice(2);
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const defaultDate = yesterday.toISOString().split('T')[0];

const startDate = args[0] || defaultDate;
const endDate = args[1] || startDate;

syncRange(startDate, endDate).catch(console.error);

const https = require('https');
const fs = require('fs');

const API_KEY = '71eb6140-1f29-46e0-bdc2-f3207e0f668e';
const BASE_HOST = 'api.triplewhale.com';
const BASE_PATH = '/api/v2';
const SHOP = 'plasmaide-uk.myshopify.com';

function request(method, path, body) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BASE_HOST,
      path: BASE_PATH + path,
      method,
      headers: {
        'x-api-key': API_KEY,
        'Accept': 'application/json',
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  const tests = [
    { name: '1. Key Validation', method: 'GET', path: '/users/api-keys/me', body: null },
    { name: '2. Summary Page', method: 'POST', path: '/summary-page/get-data', body: { shopDomain: SHOP, period: { start: '2026-04-12', end: '2026-04-19' }, todayHour: 14 } },
    { name: '3. Moby: Revenue & Orders', method: 'POST', path: '/orcabase/api/moby', body: { shopId: SHOP, question: 'What is my total revenue, total orders, AOV, and new vs returning customer split for the last 7 days?' } },
    { name: '4. Moby: Ad Performance', method: 'POST', path: '/orcabase/api/moby', body: { shopId: SHOP, question: 'What is my ad spend, revenue, ROAS, and CPA by channel for the last 7 days? Include Meta, Google, and any other connected channels.' } },
    { name: '5. Moby: Blended Metrics', method: 'POST', path: '/orcabase/api/moby', body: { shopId: SHOP, question: 'What is my blended ROAS, blended CAC, total ad spend across all channels, and MER for the last 7 days?' } },
    { name: '6. SQL: Ad Spend by Channel', method: 'POST', path: '/orcabase/api/sql', body: { shopId: SHOP, query: 'SELECT channel, SUM(spend) AS total_spend, SUM(conversion_value) AS total_revenue, SUM(conversion_value)/NULLIF(SUM(spend),0) AS roas FROM ads_table WHERE event_date BETWEEN @startDate AND @endDate GROUP BY channel ORDER BY total_spend DESC', period: { startDate: '2026-04-12', endDate: '2026-04-19' } } },
    { name: '7. Attribution Journeys', method: 'POST', path: '/attribution/get-orders-with-journeys-v2', body: { shop: SHOP, startDate: '2026-04-12T00:00:00.000Z', endDate: '2026-04-19T23:59:59.999Z', page: 1, pageSize: 10, excludeJourneyData: false } },
  ];

  for (const t of tests) {
    console.log(`\n=== ${t.name} ===`);
    const r = await request(t.method, t.path, t.body);
    console.log(`HTTP ${r.status}`);
    console.log(r.body.length > 600 ? r.body.slice(0, 600) + '...' : r.body);
  }
}

main().catch(console.error);
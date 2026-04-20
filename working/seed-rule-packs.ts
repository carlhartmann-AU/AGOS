// scripts/seed-rule-packs.ts
// Run: npx tsx scripts/seed-rule-packs.ts
// Upserts all rule packs into the rule_packs table.

import { createClient } from '@supabase/supabase-js'
import { ALL_PACKS } from '@/lib/agents/compliance/packs/seed'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  for (const pack of ALL_PACKS) {
    const { error } = await supabase
      .from('rule_packs')
      .upsert(
        {
          id: pack.id,
          name: pack.name,
          description: pack.description,
          jurisdiction: pack.jurisdiction ?? null,
          category: pack.category,
          rules: pack.rules,
          is_active: true,
        },
        { onConflict: 'id' }
      )

    if (error) {
      console.error(`✗ Failed: ${pack.id}`, error)
    } else {
      console.log(`✓ Upserted: ${pack.id} (${pack.rules.length} rules)`)
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

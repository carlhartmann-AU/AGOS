## 12. VECTOR MEMORY (Supabase pgvector)

### What gets embedded and stored

```
Brand Knowledge (per brand):
├── Brand voice examples (approved content samples)
├── Product knowledge (Pine Bark Extract science, benefits, usage)
├── Compliance rules and violation examples
├── Past campaign briefs and outcomes
├── Customer segment profiles
└── Financial model assumptions

Agent-Specific Memory (per agent per brand):
├── campaign_outcome      → Intelligence / Performance Analytics
├── tone_preference       → Content Strategy
├── brand_voice_example   → Content Strategy
├── compliance_pattern    → Compliance Agent
├── outreach_pattern      → B2B Outreach
├── cs_resolution_pattern → Customer Service
├── cro_test_result       → Web Designer
├── review_sentiment      → Review Harvester
├── market_research       → Intelligence
├── faq_knowledge         → Customer Service
└── financial_model       → CFO
```

### Memory lifecycle

1. **Write:** After successful agent invocation, n8n calls embedding API →
   writes to `agent_memory` with `brand_id`, `agent`, `memory_type`, content, embedding
2. **Read:** Before agent invocation, n8n calls Supabase RPC for semantic search →
   top-k results (k=5) injected as `memory_context` in the Claude API call
3. **Prune:** Monthly cron removes memories older than 12 months with low retrieval count
   (tracked via `metadata.retrieval_count`)

### Supabase RPC function for retrieval

```sql
CREATE OR REPLACE FUNCTION match_agent_memory(
  query_embedding vector(1536),
  match_brand_id TEXT,
  match_agent TEXT,
  match_memory_type TEXT DEFAULT NULL,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.metadata,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM agent_memory am
  WHERE am.brand_id = match_brand_id
    AND am.agent = match_agent
    AND (match_memory_type IS NULL OR am.memory_type = match_memory_type)
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---


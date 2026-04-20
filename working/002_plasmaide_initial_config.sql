-- One-off: apply initial Plasmaide compliance config.
-- Adjust the WHERE clause to match your Plasmaide brand_settings row.

UPDATE public.brand_settings
SET compliance = '{
  "enabled": true,
  "rule_packs": ["health_supplements_au", "general_marketing", "brand_voice"],
  "custom_rules": [
    {
      "id": "pine_bark_only",
      "name": "Pine Bark Extract only — no competing adaptogens",
      "description": "Plasmaide sells only Pine Bark Extract. Never mention competing adaptogens or other hero ingredients.",
      "type": "forbidden_terms",
      "severity": "major",
      "terms": [
        "ashwagandha", "ashwaganda",
        "mushroom", "mushrooms", "reishi", "lions mane", "lion''s mane", "cordyceps",
        "adaptogen", "adaptogens", "adaptogenic",
        "ginseng", "rhodiola", "maca",
        "turmeric extract", "curcumin"
      ],
      "case_sensitive": false,
      "whole_word": true,
      "action": "escalate"
    }
  ],
  "severity_actions": {
    "minor": "auto_fix",
    "major": "escalate",
    "critical": "block"
  },
  "llm_config": {
    "fast": "claude-haiku-4-5-20251001",
    "accurate": "claude-sonnet-4-6",
    "premium": "claude-opus-4-7"
  }
}'::jsonb
WHERE brand_id = 'plasmaide';

// lib/agents/compliance/packs/seed.ts
// Pre-built rule packs. Insert into rule_packs table on first deploy.

import type { RulePack } from '@/types/compliance'

export const HEALTH_SUPPLEMENTS_AU: RulePack = {
  id: 'health_supplements_au',
  name: 'Health Supplements (Australia)',
  description: 'TGA-aligned rules for supplement marketing in Australia. Blocks therapeutic claims not permitted for listed medicines.',
  jurisdiction: 'AU',
  category: 'health_supplements',
  rules: [
    {
      id: 'tga_therapeutic_claims',
      name: 'TGA therapeutic claims',
      description: 'Flags claims that assert prevention, treatment, or cure of diseases — prohibited for listed supplements under TGA.',
      type: 'llm_check',
      severity: 'major',
      model_tier: 'accurate',
      prompt: `Evaluate whether this content makes therapeutic claims that would violate TGA guidelines for listed complementary medicines. Flag content that:
- Claims to prevent, treat, cure, or diagnose any specific disease (e.g. cancer, diabetes, heart disease, arthritis)
- Asserts medical efficacy without appropriate qualification
- Uses prohibited therapeutic language like "cures", "treats", "prevents disease", "medicine", "drug"

Do NOT flag:
- General wellness language ("supports", "may help maintain", "contributes to")
- Factual statements about ingredients backed by evidence
- Lifestyle or nutritional framing
- Claims about healthy body function ("supports healthy circulation")

Be precise: quote the specific phrase if flagging.`,
    },
    {
      id: 'required_disclaimer_tga',
      name: 'TGA disclaimer present',
      description: 'Ensures content includes the standard TGA disclaimer for supplement marketing.',
      type: 'required_text',
      severity: 'minor',
      pattern: '(not intended to diagnose|consult.{0,30}healthcare|seek.{0,30}medical|always read the label)',
      flags: 'i',
      action: 'auto_fix',
      fix_template: '{content}\n\n<p><em>Always read the label and follow the directions for use. If symptoms persist, consult your healthcare professional. These statements have not been evaluated by the TGA.</em></p>',
    },
    {
      id: 'no_medical_conditions',
      name: 'No specific medical condition claims',
      description: 'Flags mentions of specific diseases linked to product benefits.',
      type: 'forbidden_terms',
      severity: 'major',
      terms: [
        'cure cancer', 'cures cancer', 'treat diabetes', 'treats diabetes',
        'heal heart disease', 'cures arthritis', 'treats hypertension',
        'cures depression', 'treats anxiety disorder',
      ],
      case_sensitive: false,
      whole_word: false,
    },
  ],
}

export const GENERAL_MARKETING: RulePack = {
  id: 'general_marketing',
  name: 'General Marketing Hygiene',
  description: 'Baseline rules every brand should run: basic truthfulness, no testimonial fabrication, reasonable claim substantiation.',
  jurisdiction: 'global',
  category: 'general',
  rules: [
    {
      id: 'no_fabricated_stats',
      name: 'No fabricated statistics',
      description: 'Flags specific-sounding statistics without citation.',
      type: 'llm_check',
      severity: 'major',
      model_tier: 'fast',
      prompt: `Flag content that includes specific statistics (e.g. "87% of customers", "3x faster", "reduces X by 42%") without any citation, study reference, or source attribution. Do not flag round numbers used obviously rhetorically (e.g. "100% committed") or generally understood industry norms. Only flag specific-sounding, unsourced claims.`,
    },
    {
      id: 'no_superlative_without_basis',
      name: 'No unsupported superlatives',
      description: 'Flags strong superlative claims without substantiation.',
      type: 'llm_check',
      severity: 'minor',
      model_tier: 'fast',
      prompt: `Flag unsupported superlative marketing claims like "world's best", "#1 brand", "most effective", "strongest available" — where the claim is made without any qualifying evidence, comparison data, or specificity. Do not flag clearly subjective framing ("we think it's great") or legitimate market positioning backed by context.`,
    },
    {
      id: 'meta_description_length',
      name: 'Meta description length',
      description: 'Keeps meta descriptions within SEO best-practice length (50-160 chars).',
      type: 'length_check',
      severity: 'minor',
      target: 'meta_description',
      min: 50,
      max: 160,
      unit: 'chars',
    },
    {
      id: 'title_length',
      name: 'Title length',
      description: 'Keeps titles within SEO best-practice length.',
      type: 'length_check',
      severity: 'minor',
      target: 'title',
      min: 20,
      max: 70,
      unit: 'chars',
    },
  ],
}

export const BRAND_VOICE: RulePack = {
  id: 'brand_voice',
  name: 'Brand Voice Alignment',
  description: 'Evaluates whether content matches the brand voice profile in settings.',
  jurisdiction: 'global',
  category: 'brand',
  rules: [
    {
      id: 'voice_alignment',
      name: 'Matches brand voice',
      description: 'Checks content against brand_profile in settings.',
      type: 'tone_check',
      severity: 'minor',
      model_tier: 'fast',
    },
  ],
}

export const ALL_PACKS: RulePack[] = [
  HEALTH_SUPPLEMENTS_AU,
  GENERAL_MARKETING,
  BRAND_VOICE,
]

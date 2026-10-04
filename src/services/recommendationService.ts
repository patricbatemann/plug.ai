import recommendationsData from '../mock/recommendations.json';

export interface AttentionRecommendation {
  id: string;
  dot: string;
  siteName: string;
  siteSubtitle: string;
  tags: { label: string; bg: string; text: string }[];
  title: string;
  rationale: string;
  facts: { label: string; value: string; valueColor: string }[];
  primaryBtnLabel: string;
  primaryBtnBg: string;
}

export interface OtherRecommendation {
  id: string;
  site: string;
  tagLabel: string;
  tagBg: string;
  tagText: string;
  title: string;
  subtitle: string;
}

/**
 * Service functions for AI advisory recommendations.
 */
export function getAttentionRecommendations(): AttentionRecommendation[] {
  return recommendationsData.attentionRecommendations;
}

export function getOtherRecommendations(): OtherRecommendation[] {
  return recommendationsData.otherRecommendations;
}

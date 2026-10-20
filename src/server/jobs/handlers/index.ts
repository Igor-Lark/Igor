import type { TaskType } from "@/lib/labels";
import { handleAdCopy } from "./ads";
import { handleContentProposal } from "./content";
import { handleCreativeReview } from "./creative";
import { handlePageFetch } from "./page-fetch";
import { handleImagePrompt } from "./prompt";
import { handleResearch } from "./research";
import { handleSeo } from "./seo";
import type { Handler } from "../types";

export const handlers: Record<TaskType, Handler> = {
  page_fetch: handlePageFetch,
  research: handleResearch,
  content_proposal: handleContentProposal,
  seo_analysis: handleSeo,
  ad_copy: handleAdCopy,
  image_prompt: handleImagePrompt,
  creative_review: handleCreativeReview,
};

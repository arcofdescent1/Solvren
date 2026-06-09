import { PRODUCT_TERMS } from "@/config/productLanguage";

export const PAGE_COPY = {
  home: {
    title: PRODUCT_TERMS.home.title,
    description: PRODUCT_TERMS.home.description,
    helper: PRODUCT_TERMS.home.helper,
  },
  issues: {
    title: PRODUCT_TERMS.problems.title,
    description: PRODUCT_TERMS.problems.description,
    helper: PRODUCT_TERMS.problems.helper,
  },
  changes: {
    title: PRODUCT_TERMS.changes.title,
    description: PRODUCT_TERMS.changes.description,
    helper: PRODUCT_TERMS.changes.helper,
  },
  actions: {
    title: PRODUCT_TERMS.decisions.title,
    description: PRODUCT_TERMS.decisions.description,
    helper: PRODUCT_TERMS.decisions.helper,
  },
  insights: {
    title: PRODUCT_TERMS.proof.title,
    description: PRODUCT_TERMS.proof.description,
    helper: PRODUCT_TERMS.proof.helper,
  },
  integrations: {
    title: PRODUCT_TERMS.integrations.title,
    description: PRODUCT_TERMS.integrations.description,
    helper: PRODUCT_TERMS.integrations.helper,
  },
  settings: {
    title: PRODUCT_TERMS.settings.title,
    description: PRODUCT_TERMS.settings.description,
    helper: PRODUCT_TERMS.settings.helper,
  },
} as const;

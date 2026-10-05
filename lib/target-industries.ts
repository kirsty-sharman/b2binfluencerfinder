export type TargetIndustryInput = {
  name: string;
  priority: number;
  taxonomyId: string | null;
  isCustom: boolean;
};

export function listValuesFromForm(formData: FormData, field: string) {
  return [...new Set(String(formData.get(field) || "")
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean))]
    .slice(0, 20);
}

export function lineValuesFromForm(formData: FormData, field: string) {
  return [...new Set(String(formData.get(field) || "")
    .split(/\n/)
    .map((value) => value.trim())
    .filter(Boolean))]
    .slice(0, 20);
}

export function targetIndustriesFromForm(formData: FormData): {
  industries: TargetIndustryInput[];
  error?: string;
} {
  const industries = [1, 2, 3, 4, 5]
    .map((priority) => ({
      name: String(formData.get(`industry${priority}`) || "").trim(),
      priority,
      taxonomyId: String(formData.get(`industry${priority}TaxonomyId`) || "").trim() || null,
      isCustom: String(formData.get(`industry${priority}IsCustom`) || "true") === "true",
    }))
    .filter((industry) => industry.name.length > 0);

  if (industries.length === 0) {
    return {
      industries: [],
      error: "Add at least one target industry so creator discovery has a market context.",
    };
  }

  const normalizedNames = industries.map((industry) => industry.name.toLocaleLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    return { industries: [], error: "Each target industry must be different." };
  }

  return { industries };
}

export type B2BIndustry = {
  id: string;
  sector: string;
  label: string;
  aliases: string[];
};

const groups: Record<string, string[]> = {
  "Agriculture & natural resources": [
    "Agriculture", "Agricultural technology", "Forestry", "Fisheries & aquaculture", "Mining & metals", "Oil & gas", "Renewable energy", "Environmental services", "Water & wastewater", "Utilities",
  ],
  "Construction & property": [
    "Architecture", "Civil engineering", "Commercial construction", "Residential construction", "Infrastructure", "Building materials", "Facilities management", "Property management", "Commercial real estate", "Residential real estate", "Real estate development", "PropTech",
  ],
  Manufacturing: [
    "Aerospace manufacturing", "Automotive manufacturing", "Chemicals", "Consumer goods manufacturing", "Defence manufacturing", "Electrical equipment", "Electronics manufacturing", "Food manufacturing", "Furniture manufacturing", "Industrial automation", "Industrial machinery", "Medical device manufacturing", "Packaging", "Paper & forest products", "Pharmaceutical manufacturing", "Plastics & rubber", "Semiconductors", "Textiles & apparel manufacturing", "Transport equipment", "Wine, beer & spirits manufacturing",
  ],
  "Wholesale, supply chain & logistics": [
    "Wholesale distribution", "Import & export", "Procurement", "Supply chain management", "Freight & trucking", "Shipping & maritime", "Rail transport", "Air freight", "Warehousing", "Courier & parcel delivery", "Cold chain", "Third-party logistics",
  ],
  "Technology & software": [
    "B2B software", "Cloud computing", "Cybersecurity", "Data & analytics", "Artificial intelligence", "Developer tools", "Enterprise software", "Financial technology", "Health technology", "Education technology", "HR technology", "Legal technology", "Marketing technology", "Retail technology", "Sales technology", "Telecommunications technology", "Internet infrastructure", "IT services", "Managed service providers", "Systems integration", "Computer hardware", "Networking", "Robotics", "Space technology",
  ],
  "Financial services": [
    "Accounting", "Banking", "Business lending", "Capital markets", "Commercial insurance", "Consumer finance", "Credit unions", "Financial advisory", "Investment banking", "Investment management", "Payments", "Private equity", "Venture capital", "Wealth management", "Risk & compliance",
  ],
  "Professional services": [
    "Business consulting", "Management consulting", "Strategy consulting", "Legal services", "Tax services", "Audit & assurance", "Market research", "Design services", "Engineering services", "Research & development", "Translation & localisation", "Training & coaching", "Certification & testing",
  ],
  "Marketing, media & communications": [
    "Advertising", "Brand consulting", "Communications", "Content marketing", "Digital marketing", "Events & exhibitions", "Marketplaces", "Media production", "News media", "Public relations", "Publishing", "Social media services", "Creative agencies", "Printing",
  ],
  "Business operations & people": [
    "Business process outsourcing", "Call centres", "Corporate travel", "Customer experience", "Human resources", "Recruitment & staffing", "Payroll", "Employee benefits", "Learning & development", "Office services", "Security services", "Workplace safety", "Document management",
  ],
  Education: [
    "Early childhood education", "Primary & secondary education", "Higher education", "Vocational education", "Professional education", "Corporate learning", "Education management", "Online education", "Education services", "Research institutions",
  ],
  "Healthcare & life sciences": [
    "Hospitals & health systems", "Primary care", "Specialist healthcare", "Mental healthcare", "Dental care", "Senior care", "Home healthcare", "Pharmaceuticals", "Biotechnology", "Medical devices", "Clinical research", "Diagnostics & laboratories", "Health insurance", "Veterinary services", "Wellness services",
  ],
  "Retail & commerce": [
    "Retail", "E-commerce", "Grocery & supermarkets", "Fashion retail", "Luxury goods", "Consumer electronics retail", "Home & garden retail", "Automotive retail", "Pharmacy retail", "Franchising", "Direct-to-consumer brands", "Marketplaces & platforms",
  ],
  "Hospitality, food & travel": [
    "Hotels & accommodation", "Restaurants", "Food service", "Catering", "Travel agencies", "Tourism", "Airlines", "Cruise lines", "Leisure facilities", "Casinos & gaming", "Theme parks & attractions",
  ],
  "Transport & mobility": [
    "Automotive services", "Aviation", "Public transport", "Mobility services", "Fleet management", "Vehicle rental", "Ports & terminals", "Rail operators", "Maritime transport", "Micromobility",
  ],
  "Public, nonprofit & membership organisations": [
    "Government administration", "Local government", "Public safety", "Defence", "International development", "Nonprofit organisations", "Charities", "Philanthropy", "Trade associations", "Professional associations", "Religious organisations", "Think tanks",
  ],
  "Arts, sport & entertainment": [
    "Arts & culture", "Museums & heritage", "Music industry", "Film & television", "Gaming", "Sports organisations", "Fitness facilities", "Recreation", "Performing arts", "Photography",
  ],
  "Consumer & field services": [
    "Automotive repair", "Cleaning services", "Home services", "Landscaping", "Pest control", "Repair & maintenance", "Personal care services", "Funeral services", "Laundry services",
  ],
};

const aliasMap: Record<string, string[]> = {
  "Agricultural technology": ["agtech"],
  "Commercial real estate": ["cre"],
  "Education technology": ["edtech"],
  "Financial technology": ["fintech"],
  "Health technology": ["healthtech", "digital health"],
  "HR technology": ["hrtech", "hcm"],
  "Marketing technology": ["martech"],
  "Property management": ["real estate management"],
  "PropTech": ["property technology"],
  "Primary & secondary education": ["k-12", "schools", "school education"],
  "Third-party logistics": ["3pl"],
  "Business process outsourcing": ["bpo"],
  "Managed service providers": ["msp"],
  "Software as a service": ["saas"],
};

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const B2B_INDUSTRY_TAXONOMY_VERSION = "b2b-organisational-buyers-v1";

export const B2B_INDUSTRIES: B2BIndustry[] = Object.entries(groups).flatMap(
  ([sector, labels]) => labels.map((label) => ({
    id: slugify(`${sector}-${label}`),
    sector,
    label,
    aliases: aliasMap[label] || [],
  })),
);

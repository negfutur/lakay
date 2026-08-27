export type LakayIntegrationCategory = "intelligence" | "images" | "audio" | "research" | "maps" | "communication" | "payments" | "authentication" | "data" | "storage" | "analytics" | "execution";
export type IntegrationReadiness = "active" | "prepared" | "requires_configuration";
export type IntegrationImpact = "safe" | "moderate" | "high";

export type LakayIntegration = {
  id: string;
  category: LakayIntegrationCategory;
  capabilities: string[];
  readiness: IntegrationReadiness;
  defaultImpact: IntegrationImpact;
  detail: string;
};

const configured = (value: string | undefined) => Boolean(value?.trim());

/**
 * Safe public metadata about capabilities Lakay can route to. It deliberately
 * exposes no keys, provider identifiers, endpoints, or user configuration.
 */
export function getLakayIntegrationRegistry(): LakayIntegration[] {
  return [
    { id: "ai-routing", category: "intelligence", capabilities: ["conversation", "planning", "code", "vision"], readiness: "active", defaultImpact: "safe", detail: "Routage IA côté serveur avec secours contrôlé." },
    { id: "builder-images", category: "images", capabilities: ["image_analysis", "secure_image_attachment"], readiness: "active", defaultImpact: "safe", detail: "Analyse d’images jointes, isolées par utilisateur et projet." },
    { id: "image-generation", category: "images", capabilities: ["image_generation", "image_editing"], readiness: "requires_configuration", defaultImpact: "moderate", detail: "Fournisseur spécialisé requis avant activation." },
    { id: "voice", category: "audio", capabilities: ["speech_to_text", "text_to_speech", "realtime_voice"], readiness: "requires_configuration", defaultImpact: "moderate", detail: "Fournisseur vocal requis avant activation." },
    { id: "research", category: "research", capabilities: ["web_search", "document_search", "project_search"], readiness: "prepared", defaultImpact: "safe", detail: "Recherche à relier à une source approuvée avant exécution." },
    { id: "maps", category: "maps", capabilities: ["maps", "places", "geolocation", "routes"], readiness: "requires_configuration", defaultImpact: "moderate", detail: "Fournisseur cartographique requis avant activation." },
    { id: "communication", category: "communication", capabilities: ["email", "sms", "push", "whatsapp"], readiness: "requires_configuration", defaultImpact: "high", detail: "Canal et consentement requis avant tout envoi." },
    { id: "stripe", category: "payments", capabilities: ["checkout", "webhooks", "credit_fulfillment"], readiness: configured(process.env.STRIPE_SECRET_KEY) && configured(process.env.LAKAY_CREDIT_PACKAGES_JSON) ? "prepared" : "requires_configuration", defaultImpact: "high", detail: "Les paiements restent confirmés et inactifs sans packages approuvés." },
    { id: "local-auth", category: "authentication", capabilities: ["email_password", "password_recovery", "manus_oauth"], readiness: "active", defaultImpact: "moderate", detail: "Authentification locale et connexion existante protégées côté serveur." },
    { id: "social-auth", category: "authentication", capabilities: ["google", "apple", "external_oauth"], readiness: "requires_configuration", defaultImpact: "moderate", detail: "Fournisseur et identifiants OAuth requis avant activation." },
    { id: "project-data", category: "data", capabilities: ["project_database", "owner_scoped_records", "migrations"], readiness: "active", defaultImpact: "moderate", detail: "Données applicatives contrôlées et isolées par propriétaire." },
    { id: "project-storage", category: "storage", capabilities: ["files", "images", "documents"], readiness: "active", defaultImpact: "moderate", detail: "Fichiers serveur sécurisés et contrôlés par projet." },
    { id: "analytics", category: "analytics", capabilities: ["events", "performance", "errors"], readiness: configured(process.env.VITE_ANALYTICS_ENDPOINT) ? "prepared" : "requires_configuration", defaultImpact: "safe", detail: "Collecte d’analyse à activer par une configuration approuvée." },
    { id: "isolated-runner", category: "execution", capabilities: ["full_stack_build", "deployment", "mobile_build"], readiness: "prepared", defaultImpact: "high", detail: "Contrat isolé préparé ; aucun code utilisateur n’est exécuté sur le serveur Lakay." },
  ];
}

export function findLakayIntegration(id: string) {
  return getLakayIntegrationRegistry().find(integration => integration.id === id);
}

export function canAutoExecuteIntegration(integration: LakayIntegration) {
  return integration.readiness === "active" && integration.defaultImpact === "safe";
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  country: string;
  gender: 'Homme' | 'Femme';
}

export type AppMode = 'home' | 'video' | 'text' | 'auth';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export const AFRICAN_COUNTRIES = [
  "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso", "Burundi",
  "Cameroun", "Cap-Vert", "Centrafrique", "Comores", "Congo (Brazzaville)", "Congo (RDC)",
  "Côte d'Ivoire", "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon",
  "Gambie", "Ghana", "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Kenya", "Lesotho",
  "Libéria", "Libye", "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie",
  "Mozambique", "Namibie", "Niger", "Nigéria", "Ouganda", "Rwanda", "São Tomé-et-Príncipe",
  "Sénégal", "Seychelles", "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Tanzanie",
  "Tchad", "Togo", "Tunisie", "Zambie", "Zimbabwe"
];
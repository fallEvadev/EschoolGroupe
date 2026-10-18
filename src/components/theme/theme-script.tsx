import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Pose la classe `dark` sur <html> avant le premier affichage, pour éviter
 * un éclair de thème clair quand l'appareil est en sombre. Le choix de la
 * personne (« clair » ou « sombre ») passe avant le réglage de l'appareil.
 * Le script est écrit ici en une seule ligne et ne lit aucune donnée externe.
 */
const SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=m==="sombre"||(m!=="clair"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

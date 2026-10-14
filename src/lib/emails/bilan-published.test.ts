import { describe, expect, it } from "vitest";

import {
  buildBilanEmail,
  escapeHtml,
  sanitizeProviderError,
  summarizeDeliveries,
  type BilanEmailInput,
} from "@/lib/emails/bilan-published";

const input: BilanEmailInput = {
  recipientName: "Moussa Ndiaye",
  schoolName: "École Les Cèdres",
  title: "Bilan hebdomadaire",
  periodLabel: "Semaine du 05/10/2026 au 11/10/2026",
  portalUrl: "https://plateforme.exemple.sn/partenaire/bilans",
  organizationName: "E-School Groupe",
};

describe("escapeHtml", () => {
  it("neutralise les caractères du HTML", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });

  it("laisse un texte ordinaire intact, accents compris", () => {
    expect(escapeHtml("École Les Cèdres")).toBe("École Les Cèdres");
  });
});

describe("buildBilanEmail", () => {
  it("écrit un objet clair avec le type, l'école et la période", () => {
    expect(buildBilanEmail(input).subject).toBe(
      "Bilan hebdomadaire · École Les Cèdres · Semaine du 05/10/2026 au 11/10/2026",
    );
  });

  it("contient le lien du portail en texte et en HTML, mais aucune pièce jointe ni lien de fichier", () => {
    const email = buildBilanEmail(input);
    expect(email.text).toContain(
      "https://plateforme.exemple.sn/partenaire/bilans",
    );
    expect(email.html).toContain(
      'href="https://plateforme.exemple.sn/partenaire/bilans"',
    );
    expect(email.text.toLowerCase()).not.toContain(".pdf");
    expect(email.html.toLowerCase()).not.toContain(".pdf");
    expect(email.text).toContain("Bonjour Moussa Ndiaye,");
  });

  it("échappe les noms insérés dans le HTML", () => {
    const email = buildBilanEmail({
      ...input,
      recipientName: '<img src=x onerror="alert(1)">',
      schoolName: "Cèdres & <b>Fils</b>",
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).not.toContain("<b>Fils</b>");
    expect(email.html).toContain("&lt;img");
    expect(email.html).toContain("Cèdres &amp; &lt;b&gt;Fils&lt;/b&gt;");
  });

  it("échappe aussi une adresse de portail piégée", () => {
    const email = buildBilanEmail({
      ...input,
      portalUrl: 'https://x.sn/"><script>alert(1)</script>',
    });
    expect(email.html).not.toContain("<script>");
  });
});

describe("sanitizeProviderError", () => {
  it("masque toute adresse e-mail", () => {
    expect(
      sanitizeProviderError("Invalid recipient awa.fall@exemple.sn for domain"),
    ).toBe("Invalid recipient [adresse] for domain");
    expect(sanitizeProviderError("a@b.c et d@e.f")).toBe(
      "[adresse] et [adresse]",
    );
  });

  it("limite la longueur et gère un message vide", () => {
    expect(sanitizeProviderError("x".repeat(500))).toHaveLength(300);
    expect(sanitizeProviderError(null)).toBe("Erreur inconnue");
    expect(sanitizeProviderError("   ")).toBe("Erreur inconnue");
  });
});

describe("summarizeDeliveries", () => {
  it("explique que l'e-mail n'est pas configuré", () => {
    expect(
      summarizeDeliveries({ configured: false, sent: 0, failed: 0 }),
    ).toContain("n'est pas configuré");
  });

  it("explique qu'il n'y a personne à prévenir", () => {
    expect(
      summarizeDeliveries({ configured: true, sent: 0, failed: 0 }),
    ).toContain("Aucun directeur actif");
  });

  it("résume envoyés et échecs, au singulier et au pluriel", () => {
    expect(summarizeDeliveries({ configured: true, sent: 1, failed: 0 })).toBe(
      "E-mails : 1 envoyé.",
    );
    expect(summarizeDeliveries({ configured: true, sent: 2, failed: 1 })).toBe(
      "E-mails : 2 envoyés, 1 en échec.",
    );
    expect(summarizeDeliveries({ configured: true, sent: 0, failed: 2 })).toBe(
      "E-mails : 2 en échec.",
    );
  });
});

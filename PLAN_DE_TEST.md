# Scénario de test en solo — E-School Groupe

Tu joues tous les rôles toi-même, en une seule séance (environ 1 h 30), depuis chez toi.
Site : https://eschool-groupe.vercel.app

## Matériel

- **Deux navigateurs** : fenêtre normale (rôles administratifs) et fenêtre privée (rôles « terrain »). Pour un troisième compte à la fois, utilise ton téléphone.
- **Une seule boîte e-mail suffit** : avec Gmail, `awa.test+formateur@gmail.com` arrive dans la boîte de `awa.test@gmail.com`. Clerk les traite comme des adresses différentes. Prévois 5 adresses :

| Rôle à jouer | Adresse à inviter |
| --- | --- |
| Formateur | `ton.adresse+formateur@gmail.com` |
| Directeur partenaire | `ton.adresse+directeur@gmail.com` |
| Admin Pédagogie | `ton.adresse+pedago@gmail.com` |
| Admin Maintenance | `ton.adresse+maint-admin@gmail.com` |
| Maintenancier | `ton.adresse+technicien@gmail.com` |

  (Si ton adresse n'est pas Gmail, utilise 5 vraies adresses.)
- **Toujours créer un mot de passe** à l'activation, jamais « Continuer avec Google ».
- Note à chaque ❓ ce qui s'affiche vraiment. S'il y a un écart, écris-le dans le tableau final.

---

## Prologue — branchement (10 min)

1. Clerk → **Webhooks** : endpoint `https://eschool-groupe.vercel.app/api/webhooks/clerk`, événements `user.created`, `user.updated`, `user.deleted`.
2. Vercel → Environment Variables : `CLERK_WEBHOOK_SIGNING_SECRET`, `NEXT_PUBLIC_APP_URL=https://eschool-groupe.vercel.app`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/activation`. **Redeploy.**
3. Clerk → Social connections : Google désactivé pour la connexion.
4. ❓ Ouvre `/connexion` en fenêtre privée : pas de bouton Google sur `/activation`.

## Acte 1 — Toi, Super-Admin : préparer l'organisation (10 min)

*Fenêtre normale, ton compte Super-Admin.*

1. Va sur `/admin/parametres`. Renseigne le nom de l'organisation, téléverse un logo (PNG < 500 Ko) et une signature. ❓ Aperçu visible.
2. Va sur `/admin/acces` → **Donner un accès** : crée les 5 personnes du tableau ci-dessus, chacune avec son rôle et un téléphone.
3. ❓ Message « Accès créé. Une invitation a été envoyée ». Ouvre ta boîte : 5 e-mails d'invitation.
4. `/admin/personnel` : ❓ les 5 fiches sont à l'état **invité**.

## Acte 2 — Activer les 5 comptes (15 min)

Pour **chaque** e-mail reçu :
1. Ouvre le lien dans la fenêtre privée (ferme la session précédente avant le suivant).
2. Crée un mot de passe, confirme l'e-mail.
3. ❓ Tu arrives dans le bon espace : formateur → `/formateur`, directeur → `/partenaire`, pédago/maint-admin → `/admin`, technicien → `/maintenance`.
4. Déconnecte-toi.

Contrôle après les 5 : Clerk → Webhooks → *Message Attempts* : 5 envois verts. `/admin/personnel` : 5 fiches **actives**.
**Si un compte affiche « Aucune fiche… n'est liée »** : arrête-toi, note l'e-mail utilisé et l'état du webhook, et dis-le-moi.

## Acte 3 — Le règlement intérieur (5 min)

1. Super-Admin, `/admin/reglement` : publie une version du règlement.
2. Connecte-toi en **formateur** puis en **technicien** : ❓ chacun doit accepter le règlement avant d'avancer.
3. Directeur et admins : ❓ aucune acceptation demandée.

## Acte 4 — Admin Pédagogie : l'école, le créneau, le code (10 min)

*Connecte-toi avec l'adresse `+pedago`.*

1. `/admin/ecoles` → crée l'école **« École Test »**. Rattache le directeur (`+directeur`).
2. Crée un **créneau** qui couvre l'heure actuelle, pour **le jour d'aujourd'hui** (ex. de 30 minutes avant maintenant à 2 h après). Affecte le formateur.
   *Le pointage n'est possible que de 30 min avant le début jusqu'à la fin du créneau.*
3. `/admin/codes` → génère le code du jour. ❓ Un code à 6 chiffres pour « École Test ».
4. Teste « Régénérer » : ❓ le nouveau code remplace l'ancien. Note le code final.

## Acte 5 — Directeur partenaire : position de l'école (5 min)

*Connecte-toi avec `+directeur`, depuis chez toi (ton « école » sera ta position).*

1. `/partenaire` : ❓ tu vois le code du jour de « École Test » et le bouton **Copier**.
2. Enregistre la **position de l'école** (autorise la localisation). ❓ Position enregistrée.
3. `/partenaire/bilans` : ❓ liste vide (normal).

## Acte 6 — Formateur : pointage et rapport (20 min)

*Connecte-toi avec `+formateur`, de préférence sur ton téléphone, au même endroit que l'étape 5.*

1. `/formateur` : ❓ le créneau du jour apparaît avec « 📍 Je suis arrivé à l'école ».
2. **Essai raté** : saisis 5 codes faux. ❓ Blocage de 15 min (tu peux sauter cet essai et le faire à la fin).
3. **Pointage réussi** : saisis le bon code, autorise la localisation. ❓ « Pointage enregistré avec succès. »
4. Pointe encore une fois le même créneau. ❓ Refus.
5. Menu **Cahiers** → ouvre le rapport du jour. ❓ Le formulaire a : Classe(s), Thème du cours, matériel et pannes.
   ⚠️ Les **heures d'arrivée et de descente** n'y sont pas : note-le comme écart connu.
6. Remplis « Classe : 3e A », « Thème : les tableaux Excel ». Clique **Enregistrer le brouillon**. ❓ Brouillon gardé.
7. Ajoute une **panne** (« Autre équipement » : « Projecteur », description « ne s'allume plus »).
8. Coupe le Wi-Fi/les données, modifie le thème. ❓ Message « Pas de connexion… saisie gardée », aucun envoi automatique. Remets le réseau.
9. Clique **Envoyer à la Direction**. ❓ Statut « soumis ». Tente de modifier : ❓ impossible.
10. Cloche : ❓ pas de notification (c'est la Direction qui est prévenue).

## Acte 7 — Admin Pédagogie : valider le rapport (10 min)

*Reconnecte-toi avec `+pedago`.*

1. Cloche : ❓ une notification « rapport envoyé ».
2. `/admin/rapports` : ❓ le rapport est à traiter.
3. **Demande de modification** : essaie d'abord sans commentaire (❓ refus), puis avec « Précisez le chapitre ».
4. Reconnecte-toi en **formateur** : ❓ cloche + rapport « à modifier » avec le commentaire. Corrige le thème, **renvoie**. ❓ Aucun doublon de panne.
5. Retour en **pédago** : **valide** le rapport. ❓ Il est verrouillé.
6. Formateur : ❓ notification « validé », rapport impossible à modifier.
7. `/admin/pointages` : ❓ le pointage du jour apparaît. Teste « Marquer sans cours » sur un autre jour si tu veux.

## Acte 8 — Maintenance : le ticket de la panne (15 min)

1. Connecte-toi avec `+maint-admin` : ❓ cloche avec « nouveau ticket ». `/admin/maintenance` : ticket « Projecteur », statut **ouvert**.
2. `/admin/parc` : ajoute une machine **« Projecteur 1 »** dans « École Test ».
3. Retour sur le ticket : utilise **« Rattacher à une machine »** → Projecteur 1. ❓ Confirmation, puis le ticket prend le nom de la machine.
4. **Affecte** le ticket au technicien (`+technicien`). ❓ Un formateur ne figure pas dans la liste.
5. Connecte-toi avec `+technicien` : ❓ cloche « ticket affecté ». `/maintenance` → « Mes tickets » : ❓ **aucun nom de formateur**.
6. **Prendre en charge** → statut « en cours ». **Marquer résolu** sans note (❓ refus), puis avec « Lampe remplacée » (❓ accepté).
7. `/maintenance/interventions` : ❓ ticket dans l'historique.
8. Retour `+maint-admin` : ❓ statistiques de la page à jour (résolus : 1).

## Acte 9 — Bilan et publication (15 min)

1. `+pedago` → `/admin/bilans` : période par défaut (dernière terminée). Comme ton rapport date d'**aujourd'hui**, choisis **le mois en cours** ou la semaine d'aujourd'hui.
2. **Générer / Actualiser** : ❓ un bilan pour « École Test » avec 1 rapport.
3. **Télécharger le Word** : ❓ page paysage, logo, synthèse, tableau, panne, signature.
4. Fais un PDF de test (enregistre le Word en PDF depuis Word), **dépose-le**, clique **Voir le PDF**.
5. **Publier** : ❓ message « Bilan publié. E-mails : … » (sans Resend : « L'e-mail n'est pas configuré »). Régénère : ❓ le bilan publié est ignoré.
6. `+directeur` : ❓ cloche « bilan publié », `/partenaire/bilans` : PDF téléchargeable.

## Acte 10 — Admin RH et contrôles de sécurité (10 min)

1. Crée une adresse `+rh` en Admin RH depuis `/admin/acces`, active-la, connecte-toi. ❓ Menu : Personnel et Règlement uniquement.
2. `/admin/personnel` : complète une fiche, ajoute un document (CV) dans le dossier d'un formateur, valide-le.
3. **Interdits** : dans le navigateur, tape à la main :
   - formateur → `/admin`, `/maintenance` ❓ « non autorisé »
   - directeur → `/formateur`, `/admin/bilans` ❓ refusé
   - technicien → `/admin/maintenance` ❓ refusé
   - RH → `/admin/rapports` ❓ refusé
   - Sans connexion (fenêtre privée) → n'importe quelle page ❓ redirection vers `/connexion`
4. Super-Admin : `/admin/parametres` ❓ journal d'audit : les actions sont listées, sans codes ni commentaires.
5. À 360 px (téléphone) : ❓ aucun défilement horizontal sur chaque espace.

---

## Tableau de bord de la séance

| Acte | Réussi ? | Écart observé (message exact) |
| --- | --- | --- |
| Prologue | | |
| 1 Organisation | | |
| 2 Activation | | |
| 3 Règlement | | |
| 4 École / code | | |
| 5 Position | | |
| 6 Pointage / rapport | | |
| 7 Validation | | |
| 8 Maintenance | | |
| 9 Bilan | | |
| 10 RH / sécurité | | |

**Écarts déjà connus** : heures d'arrivée et de descente absentes du rapport · e-mail Resend non testable sans clé et domaine.

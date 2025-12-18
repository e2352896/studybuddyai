const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

exports.summarizeNote = onCall({secrets: [OPENAI_API_KEY]}, async (req) => {
  try {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }

    const {noteId} = req.data || {};
    if (!noteId) {
      throw new HttpsError("invalid-argument", "noteId manquant.");
    }

    const uid = req.auth.uid;

    const snap = await admin.firestore().collection("notes").doc(noteId).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Note introuvable.");
    }

    const note = snap.data();
    if (note.uid !== uid) {
      throw new HttpsError("permission-denied", "Accès refusé.");
    }

    const title = note.title || "";
    const content = note.content || "";

    // ✅ Import OpenAI *dans la function* (pas au top-level)
    const {OpenAI} = require("openai");
    const client = new OpenAI({apiKey: OPENAI_API_KEY.value()});

    const prompt = `Résume clairement en français 
    (5-7 lignes max) cette note d'étude.
      Titre: ${title}
      Contenu: ${content}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {role: "system", content: "Tu es un assistant pédagogique concis."},
        {role: "user", content: prompt},
      ],
      temperature: 0.4,
    });

    const summary =
      (completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content &&
        completion.choices[0].message.content.trim()) ||
      "Aucun résumé.";

    await admin.firestore().collection("notes").doc(noteId).update({
      aiSummary: summary,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {summary};
  } catch (err) {
    // Si c'est déjà une HttpsError, on la renvoie
    if (err instanceof HttpsError) throw err;

    console.error("summarizeNote error:", err);
    throw new HttpsError("internal", "Erreur serveur OpenAI/Function.");
  }
});

const RECAPTCHA_V2_SECRET = defineSecret("RECAPTCHA_V2_SECRET");

exports.verifyRecaptchaV2 = onCall(
    {secrets: [RECAPTCHA_V2_SECRET]},
    async (req) => {
      const {token} = req.data || {};
      if (!token) {
        throw new HttpsError("invalid-argument", "Token reCAPTCHA manquant.");
      }

      const secret = RECAPTCHA_V2_SECRET.value();

      const body = new URLSearchParams();
      body.append("secret", secret);
      body.append("response", token);

      // Optionnel: IP utilisateur (pas toujours dispo)
      // if (req.rawRequest?.ip) body.append("remoteip", req.rawRequest.ip);

      const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body,
      });

      const data = await resp.json();

      // v2 => data.success boolean
      if (!data.success) {
        throw new HttpsError("permission-denied", "Échec reCAPTCHA. Réessaie.");
      }

      return {ok: true};
    });

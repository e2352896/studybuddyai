import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { initAppCheck } from "./AppCheck";
import { listenAuth, loginGoogle, loginGithub, logout } from "./auth";
import { listenNotes, createNote, updateNote, deleteNote } from "./firestore";
import { uploadNoteFile } from "./storage";
import { summarizeNote } from "./openai";
import ReCAPTCHA from "react-google-recaptcha";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";


export default function App() {
  const [captchaOk, setCaptchaOk] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const verifyRecaptcha = httpsCallable(functions, "verifyRecaptchaV2");


  const [user, setUser] = useState(null);

  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    initAppCheck(); // App Check
    const unsub = listenAuth((u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotes([]);
      setSelectedId(null);
      return;
    }
    const unsub = listenNotes(user.uid, (items) => {
      setNotes(items);
      if (!selectedId && items[0]) setSelectedId(items[0].id);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!selected) {
      setTitle("");
      setContent("");
      return;
    }
    setTitle(selected.title || "");
    setContent(selected.content || "");
  }, [selectedId, selected]);

  async function onCreate() {
    if (!user) return;
    setBusy(true);
    setStatus("");
    try {
      await createNote(user.uid, "Nouvelle note", "Écris ici...");
      setStatus("✅ Note créée");
    } catch (e) {
      setStatus("❌ " + (e?.message || "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  async function onSave() {
    if (!selected) return;
    setBusy(true);
    setStatus("");
    try {
      await updateNote(selected.id, { title, content });
      setStatus("✅ Sauvegardé");
    } catch (e) {
      setStatus("❌ " + (e?.message || "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    setBusy(true);
    setStatus("");
    try {
      await deleteNote(selected.id);
      setSelectedId(null);
      setStatus("🗑️ Supprimé");
    } catch (e) {
      setStatus("❌ " + (e?.message || "Erreur"));
    } finally {
      setBusy(false);
    }
  }

  async function onUploadFile(file) {
    if (!user || !selected || !file) return;
    setBusy(true);
    setStatus("");
    try {
      const { url, path } = await uploadNoteFile({
        uid: user.uid,
        noteId: selected.id,
        file,
      });
      await updateNote(selected.id, { fileURL: url, filePath: path });
      setStatus("📦 Fichier téléversé");
    } catch (e) {
      setStatus("❌ " + (e?.message || "Erreur upload"));
    } finally {
      setBusy(false);
    }
  }

  async function onSummarize() {
    if (!selected) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await summarizeNote(selected.id);
      setStatus("🤖 Résumé généré");
      console.log("Résumé OpenAI:", res);
      // Le résumé est aussi stocké dans Firestore (aiSummary)
    } catch (e) {
      setStatus("❌ " + (e?.message || "Erreur OpenAI"));
    } finally {
      setBusy(false);
    }
  }
  async function handleCaptcha(token) {
  setCaptchaLoading(true);
  setCaptchaOk(false);
  try {
    await verifyRecaptcha({ token });
    setCaptchaOk(true);
  } catch (e) {
    setCaptchaOk(false);
    alert("❌ reCAPTCHA invalide. Réessaie.", e);
  } finally {
    setCaptchaLoading(false);
  }
}


  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1>StudyBuddy AI</h1>
          <p className="sub">Firebase Auth • Firestore • Storage • App Check • Functions • OpenAI • Hosting</p>
        </div>

        <div className="authbox">
          {!user ? (
            <>
              <div style={{ marginBottom: 10 }}>
                <ReCAPTCHA
                  sitekey={import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY}
                  onChange={handleCaptcha}
                />
              </div>

              <button disabled={!captchaOk || captchaLoading} onClick={loginGoogle}>
                Login Google
              </button>
              <button disabled={!captchaOk || captchaLoading} onClick={loginGithub}>
                Login GitHub
              </button>

              <div className="hint" style={{ marginTop: 8 }}>
                {captchaOk
                  ? "✅ reCAPTCHA validé : tu peux te connecter."
                  : ""}
              </div>
            </>
          ) : (
            <>
              <div className="user">
                <div className="name">{user.displayName || "Utilisateur"}</div>
                <div className="email">{user.email}</div>
              </div>
              <button className="secondary" onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </header>

      <main className="grid">
        <aside className="panel">
          <div className="panelHead">
            <h2>Mes notes</h2>
            <button disabled={!user || busy} onClick={onCreate}>+ Ajouter</button>
          </div>

          {!user ? (
            <p className="hint">Connecte-toi pour voir tes notes.</p>
          ) : notes.length === 0 ? (
            <p className="hint">Aucune note. Clique “Ajouter”.</p>
          ) : (
            <ul className="list">
              {notes.map((n) => (
                <li
                  key={n.id}
                  className={n.id === selectedId ? "active" : ""}
                  onClick={() => setSelectedId(n.id)}
                >
                  <div className="title">{n.title || "Sans titre"}</div>
                  {n.aiSummary ? <div className="badge">AI</div> : null}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="panel">
          <div className="panelHead">
            <h2>Éditeur</h2>
            <div className="actions">
              <button disabled={!selected || busy} onClick={onSave}>Sauvegarder</button>
              <button disabled={!selected || busy} className="danger" onClick={onDelete}>Supprimer</button>
            </div>
          </div>

          {!selected ? (
            <p className="hint">Sélectionne une note.</p>
          ) : (
            <>
              <label className="label">Titre</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />

              <label className="label">Contenu</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                disabled={busy}
              />

              <div className="row">
                <div>
                  <label className="label">Fichier (Storage)</label>
                  <input
                    type="file"
                    disabled={!user || !selected || busy}
                    onChange={(e) => onUploadFile(e.target.files?.[0])}
                  />
                  {selected.fileURL ? (
                    <a className="link" href={selected.fileURL} target="_blank" rel="noreferrer">
                      Ouvrir le fichier
                    </a>
                  ) : (
                    <div className="hint">Aucun fichier lié.</div>
                  )}
                </div>

                <div className="aiBox">
                  <label className="label">OpenAI</label>
                  <button disabled={!selected || busy} onClick={onSummarize}>
                    Résumer avec IA
                  </button>
                  {selected.aiSummary ? (
                    <div className="summary">{selected.aiSummary}</div>
                  ) : (
                    <div className="hint">Pas encore de résumé.</div>
                  )}
                </div>
              </div>

              {status ? <div className="status">{status}</div> : null}
            </>
          )}
        </section>
      </main>

      <footer className="foot">
        <span>✅ Projet d’examen — simple, démontrable, conforme.</span>
      </footer>
    </div>
  );
}

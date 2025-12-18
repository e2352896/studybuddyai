import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

export async function summarizeNote(noteId) {
  const fn = httpsCallable(functions, "summarizeNote");
  const res = await fn({ noteId });
  return res.data; // { summary: "..." }
}

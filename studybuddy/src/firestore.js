import { db } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export function listenNotes(uid, cb) {
  const ref = collection(db, "notes");
  const q = query(ref, where("uid", "==", uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(items);
  });
}

export async function createNote(uid, title, content) {
  await addDoc(collection(db, "notes"), {
    uid,
    title,
    content,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateNote(noteId, data) {
  await updateDoc(doc(db, "notes", noteId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(noteId) {
  await deleteDoc(doc(db, "notes", noteId));
}

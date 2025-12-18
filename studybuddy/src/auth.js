import { auth } from "./firebase";
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const githubProvider = new GithubAuthProvider();
const googleProvider = new GoogleAuthProvider();

export function listenAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function loginGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function loginGithub() {
  await signInWithPopup(auth, githubProvider);
}

export async function logout() {
  await signOut(auth);
}

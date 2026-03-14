import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDwsQfxaqh6QazyQrcBVJdth85fFh4BwlE",
  authDomain: "gen-lang-client-0370785636.firebaseapp.com",
  projectId: "gen-lang-client-0370785636",
  storageBucket: "gen-lang-client-0370785636.firebasestorage.app",
  messagingSenderId: "550344467221",
  appId: "1:550344467221:web:32c3c71aeab254de67bf1c"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
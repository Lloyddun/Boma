import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCbUrJehHvFy4Q1yV9qR9Fw7IWg0ibS9w8",
  authDomain: "boma-97ed2.firebaseapp.com",
  projectId: "boma-97ed2",
  storageBucket: "boma-97ed2.firebasestorage.app",
  messagingSenderId: "568773881974",
  appId: "1:568773881974:web:fa432f7196f6ea5eeaef57"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

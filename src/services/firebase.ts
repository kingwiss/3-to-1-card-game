import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_HxK1RjO2R7sbKat6tB9S2A7pvNRzR7g",
  authDomain: "aaa-app-c5434.firebaseapp.com",
  projectId: "aaa-app-c5434",
  storageBucket: "aaa-app-c5434.firebasestorage.app",
  messagingSenderId: "165861782730",
  appId: "1:165861782730:web:5fc145637456e0ed7ff033",
  measurementId: "G-YPQ3X7L2SF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

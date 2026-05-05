import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Importado Firestore

const firebaseConfig = {
  apiKey: "AIzaSyAguzA0YUsAGUnx86Kx-V1mgmtaVrjDUqE",
  authDomain: "arsense-9f3a4.firebaseapp.com",
  databaseURL: "https://arsense-9f3a4-default-rtdb.firebaseio.com", // Opcional no Firestore, mas pode manter
  projectId: "arsense-9f3a4",
  storageBucket: "arsense-9f3a4.firebasestorage.app",
  messagingSenderId: "211530848431",
  appAddId: "1:211530848431:web:48ac70f2b6abb86a199c5a",
  measurementId: "G-JTLZP99FW9"
};

// Inicialização do Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// --- EXPORTAÇÕES PARA O FIRESTORE ---

export const auth = getAuth(app);

// Agora exportamos 'db' como a instância do Firestore
export const db = getFirestore(app);

// Se você tiver telas que AINDA dependem do Realtime Database, 
// você pode manter a linha abaixo temporariamente. 
// Caso contrário, pode deletá-la:
// import { getDatabase } from "firebase/database";
// export const database = getDatabase(app);
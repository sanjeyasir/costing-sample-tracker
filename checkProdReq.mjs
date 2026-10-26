
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3c1hXFel0ujA-z7uEzCAtFI5mvlltlZM",
  authDomain: "costing-sample-tracker-prod.firebaseapp.com",
  projectId: "costing-sample-tracker-prod",
  storageBucket: "costing-sample-tracker-prod.firebasestorage.app",
  messagingSenderId: "1054640778384",
  appId: "1:1054640778384:web:414f53986693c4a7a8fc15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkReq() {
  const q = query(collection(db, "costingRequests"), where("costRequestNo", "==", "2627-C-H-0026"));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("No request found with costRequestNo 2627-C-H-0026. Checking by ID or scanning...");
    const allSnap = await getDocs(collection(db, "costingRequests"));
    allSnap.forEach(d => {
      const data = d.data();
      if (String(data.costRequestNo || "").includes("0026")) {
        console.log("Found match:", d.id, JSON.stringify(data, null, 2));
      }
    });
  } else {
    snap.forEach(d => {
      console.log("Found request:", d.id);
      console.log(JSON.stringify(d.data(), null, 2));
    });
  }
}

checkReq().catch(console.error);

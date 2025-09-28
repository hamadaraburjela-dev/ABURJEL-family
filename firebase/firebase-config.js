// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8Q8", // Replace with your actual API key
  authDomain: "family-aid-system.firebaseapp.com",
  projectId: "family-aid-system",
  storageBucket: "family-aid-system.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Export for use in other files
window.db = db;
window.auth = auth;
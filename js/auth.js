// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-analytics.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBz4CJRYO-HjNs-77vyxA-Bdcf4ihSeH5o",
    authDomain: "task-track---login-4b5f9.firebaseapp.com",
    projectId: "task-track---login-4b5f9",
    storageBucket: "task-track---login-4b5f9.appspot.com",
    messagingSenderId: "898650919931",
    appId: "1:898650919931:web:8daf17dc06b9fc5d62715e",
    measurementId: "G-47J31JQ3JH"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Admin UIDs: Add new admin UIDs here
const adminUids = [
    "1WrUyeslVQamX5nk7DTqrB2padS2",
    "fOwJWIIQlEhUE7SZInOoaPecB7i1",
];

// Signup: default role to "employee" unless explicitly passed as "admin"
export async function handleSignup(event, role = "employee") {
    event.preventDefault();

    const username = document.getElementById('signup-username').value.trim();
    const lastname = document.getElementById('signup-lastname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    if (!username || !lastname) {
        alert("First name and last name are required.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Determine final role: if UID is in adminUids, assign as admin
        let userRole = role;
        if (adminUids.includes(user.uid)) {
            userRole = "admin";
        }

        // Add user to Firestore /users collection
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            role: userRole,
            username,
            lastname,
            createdAt: new Date()
        });

        // If the user is an employee, also add to Admin/{adminUid}/employee/{employeeUid} for all admins
        if (userRole === "employee") {
            for (const adminUid of adminUids) {
                await setDoc(doc(db, "Admin", adminUid, "employee", user.uid), {
                    uid: user.uid,
                    email: user.email,
                    role: userRole,
                    username,
                    lastname,
                    createdAt: new Date()
                });
            }
        }

        alert("Signup successful! Please log in.");
        window.location.href = "index.html";
    } catch (error) {
        alert("Signup failed: " + error.message);
    }
}

// Login handler: redirects based on role or if UID is in adminUids
export async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Get user role from Firestore
        const userDoc = await getDoc(doc(db, "users", uid));
        const userData = userDoc.data();
        localStorage.setItem("uid", uid);
        localStorage.setItem("role", userData.role);
        localStorage.setItem("username", userData.username || "");
        localStorage.setItem("lastname", userData.lastname || "");
        localStorage.setItem("email", userData.email || "");

        // Grant admin dashboard if role is admin or if UID is in adminUids
        if (userData.role === "admin" || adminUids.includes(uid)) {
            window.location.href = "dashboard-admin.html";
        } else {
            window.location.href = "dashboard-employee.html";
        }
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}
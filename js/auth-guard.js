onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // Not logged in, allow both login and signup page
        if (
            !path.includes("index.html") &&
            !path.includes("signup.html")
        ) {
            window.location.href = "index.html";
        }
        return;
    }
    // Get user doc
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
        alert("No Firestore user doc found for UID: " + user.uid + ". Please contact admin.");
        await auth.signOut();
        window.location.href = "index.html";
        return;
    }
    const role = userDoc.data().role;
    if (!role) {
        alert("User Firestore doc missing 'role' field. Please contact admin.");
        await auth.signOut();
        window.location.href = "index.html";
        return;
    }
    // Redirect to correct dashboard if on the wrong one
    if (path.includes("dashboard-admin") && role !== "admin") {
        window.location.href = "dashboard-employee.html";
    } else if (path.includes("dashboard-employee") && role !== "employee") {
        window.location.href = "dashboard-admin.html";
    }
    // If on index.html or signup.html, let them stay (no redirect needed)
});
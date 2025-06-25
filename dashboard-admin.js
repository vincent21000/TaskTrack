import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    setDoc,
    updateDoc,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";

const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/djkjh7x7q/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "track_task";

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
const db = getFirestore(app);
const auth = getAuth(app);

// Always use this admin UID when fetching/administering tasks
const adminUid = "1WrUyeslVQamX5nk7DTqrB2padS2";

function formatDateTime(date) {
    if (!date) return "";
    let d;
    if (typeof date === "string") {
        d = new Date(date);
    } else if (typeof date.toDate === "function") {
        d = date.toDate();
    } else {
        d = date;
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mins}`;
}

// --- Always update both admin & employee copies ---
async function syncTaskWithAdminAndEmployee(taskId, employeeUid, updates) {
    const adminRef = doc(db, "users", adminUid, "tasks", taskId);
    const empRef = doc(db, "users", employeeUid, "tasks", taskId);
    try { await updateDoc(adminRef, updates); } catch (err) { console.warn(err); }
    try { await updateDoc(empRef, updates); } catch (err) { console.warn(err); }
}

// --- Populate "Assign To" with ONLY admin's employees (no duplicates) ---
async function populateEmployeesDropdown() {
    const assignSelect = document.getElementById('task-assign');
    assignSelect.innerHTML = `<option value="">Choose employee</option>`;
    const employeesSnap = await getDocs(collection(db, "Admin", adminUid, "employee"));
    const seen = new Set();
    employeesSnap.forEach(docSnap => {
        const emp = docSnap.data();
        if (emp.uid && !seen.has(emp.uid)) {
            seen.add(emp.uid);
            const option = document.createElement("option");
            option.value = emp.uid;
            option.textContent = `${emp.username || ""} ${emp.lastname || ""} (${emp.email || ""})`;
            assignSelect.appendChild(option);
        }
    });
}
auth.onAuthStateChanged(user => { if (user) populateEmployeesDropdown(); });
const createTaskNav = document.querySelector('a[onclick="showSection(\'createTask\')"]');
if (createTaskNav) createTaskNav.addEventListener('click', populateEmployeesDropdown);

// --- Render Employee List in Manage User section ---
async function renderEmployeeList() {
    const listDiv = document.getElementById('employee-list');
    listDiv.innerHTML = "";
    const employeesSnap = await getDocs(collection(db, "Admin", adminUid, "employee"));
    const seen = new Set();
    let count = 0;
    employeesSnap.forEach(docSnap => {
        const emp = docSnap.data();
        if (emp.uid && !seen.has(emp.uid)) {
            seen.add(emp.uid);
            const card = document.createElement('div');
            card.className = "employee-card";
            card.innerHTML = `
                <strong>${emp.username || "First Name"}</strong> <span>${emp.lastname || ""}</span>
                <div class="employee-email">${emp.email || ""}</div>
            `;
            listDiv.appendChild(card);
            count++;
        }
    });
    if (count === 0) {
        listDiv.innerHTML = "<p style='color:#63c1f5;'>No employees found.</p>";
    }
}
const manageUserNav = document.querySelector('a[onclick="showSection(\'manageUser\')"]');
if (manageUserNav) manageUserNav.addEventListener('click', renderEmployeeList);
auth.onAuthStateChanged(user => { if (user) renderEmployeeList(); });

// --- Handle Create Task Form (write to both admin & employee) ---
const createTaskForm = document.getElementById('create-task-form');
if (createTaskForm) {
    createTaskForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const user = auth.currentUser;
        if (!user) { alert("You must be logged in to create tasks."); return; }
        const title = document.getElementById('task-title').value.trim();
        const desc = document.getElementById('task-desc').value.trim();
        const assignToId = document.getElementById('task-assign').value;
        const dueDate = document.getElementById('task-due').value;

        if (!assignToId || assignToId === "") {
            alert("Please select an employee to assign.");
            return;
        }

        try {
            // Generate the same ID for both locations
            const adminTaskRef = doc(collection(db, "users", adminUid, "tasks"));
            const taskId = adminTaskRef.id;
            const taskData = {
                title,
                description: desc,
                assignToId,
                dueDate,
                createdAt: new Date(),
                status: "Unfinished",
                evidenceUrl: "",
                doneDate: ""
            };

            // Write to admin's tasks
            await setDoc(adminTaskRef, taskData);

            // Write to employee's tasks
            const employeeTaskRef = doc(db, "users", assignToId, "tasks", taskId);
            await setDoc(employeeTaskRef, taskData);

            alert("Task created successfully!");
            event.target.reset();
        } catch (error) {
            alert("Error creating task: " + error.message);
        }
    });
}

// --- Render All Tasks (Unfinished) ---
const allTasksNav = document.querySelector('a[onclick="showSection(\'allTasks\')"]');
if (allTasksNav) allTasksNav.addEventListener('click', subscribeAndRenderTasks);

let unsubscribeTasksListener = null;
function subscribeAndRenderTasks() {
    // Use adminUid so we always get all admin-assigned tasks
    if (unsubscribeTasksListener) unsubscribeTasksListener();
    unsubscribeTasksListener = onSnapshot(collection(db, "users", adminUid, "tasks"), snapshot => {
        renderTasksTable(snapshot.docs);
    });
}
auth.onAuthStateChanged(user => { if (user) subscribeAndRenderTasks(); });

async function renderTasksTable(taskDocs) {
    const tableBody = document.getElementById('tasks-table-body');
    tableBody.innerHTML = "";
    const employeesSnap = await getDocs(collection(db, "Admin", adminUid, "employee"));
    const employees = new Map();
    employeesSnap.forEach(doc => {
        const emp = doc.data();
        if (emp.uid && !employees.has(emp.uid)) {
            employees.set(emp.uid, `${emp.username || ""} ${emp.lastname || ""} (${emp.email || ""})`);
        }
    });

    for (const docSnap of taskDocs) {
        const task = docSnap.data();
        const taskId = docSnap.id;
        if (task.status === "Done") continue;
        const assignedName = employees.get(task.assignToId) || "Unknown";
        const row = document.createElement('tr');

        // Evidence cell
        let evidenceCell = "";
        if (task.evidenceUrl) {
            evidenceCell = `<a href="${task.evidenceUrl}" target="_blank" rel="noopener noreferrer" class="evidence-link">View Evidence</a>`;
        } else {
            evidenceCell = `<input type="file" accept="image/*,.pdf" data-taskid="${taskId}">`;
        }

        // Inline Editing for admin only: title, dueDate, status
        row.innerHTML = `
            <td><span class="task-title">${task.title || ""}</span></td>
            <td><span class="task-assigned">${assignedName}</span></td>
            <td><span class="task-due">${task.dueDate || ""}</span></td>
            <td>
                <select data-edit-status data-taskid="${taskId}" disabled>
                    <option value="Unfinished"${task.status === "Unfinished" ? " selected" : ""}>Unfinished</option>
                    <option value="Done"${task.status === "Done" ? " selected" : ""}>Done</option>
                </select>
            </td>
            <td>${evidenceCell}</td>
            <td>
                <button class="edit-btn primary-btn" data-taskid="${taskId}">Edit</button>
                <button class="save-btn primary-btn" data-taskid="${taskId}" style="display:none;">Save</button>
                <button class="cancel-btn" data-taskid="${taskId}" style="display:none;">Cancel</button>
            </td>
        `;

        let editing = false;
        const editBtn = row.querySelector('.edit-btn');
        const saveBtn = row.querySelector('.save-btn');
        const cancelBtn = row.querySelector('.cancel-btn');
        const titleSpan = row.querySelector('.task-title');
        const dueSpan = row.querySelector('.task-due');
        const statusSelect = row.querySelector('select[data-edit-status]');
        let originalTitle = task.title;
        let originalDueDate = task.dueDate;
        let originalStatus = task.status;

        editBtn.addEventListener('click', () => {
            if (editing) return;
            editing = true;
            // Replace spans with inputs
            const titleInput = document.createElement('input');
            titleInput.type = "text";
            titleInput.value = originalTitle;
            titleInput.className = "edit-title-input";
            titleSpan.parentNode.replaceChild(titleInput, titleSpan);

            const dueInput = document.createElement('input');
            dueInput.type = "date";
            dueInput.value = originalDueDate;
            dueInput.className = "edit-due-input";
            dueSpan.parentNode.replaceChild(dueInput, dueSpan);

            statusSelect.disabled = false;
            editBtn.style.display = "none";
            saveBtn.style.display = "";
            cancelBtn.style.display = "";
        });

        saveBtn.addEventListener('click', async () => {
            const titleInput = row.querySelector('.edit-title-input');
            const dueInput = row.querySelector('.edit-due-input');
            const newTitle = titleInput.value.trim();
            const newDueDate = dueInput.value;
            const newStatus = statusSelect.value;

            const updates = {
                title: newTitle,
                dueDate: newDueDate,
                status: newStatus,
                doneDate: newStatus === "Done" ? formatDateTime(new Date()) : ""
            };
            // ALWAYS update both admin and employee copy!
            await syncTaskWithAdminAndEmployee(taskId, task.assignToId, updates);

            // UI revert
            const newTitleSpan = document.createElement('span');
            newTitleSpan.className = "task-title";
            newTitleSpan.textContent = newTitle;
            titleInput.parentNode.replaceChild(newTitleSpan, titleInput);

            const newDueSpan = document.createElement('span');
            newDueSpan.className = "task-due";
            newDueSpan.textContent = newDueDate;
            dueInput.parentNode.replaceChild(newDueSpan, dueInput);

            originalTitle = newTitle;
            originalDueDate = newDueDate;
            originalStatus = newStatus;

            statusSelect.disabled = true;
            editBtn.style.display = "";
            saveBtn.style.display = "none";
            cancelBtn.style.display = "none";
            editing = false;
        });

        cancelBtn.addEventListener('click', () => {
            // UI revert
            const titleInput = row.querySelector('.edit-title-input');
            const dueInput = row.querySelector('.edit-due-input');

            const revertTitleSpan = document.createElement('span');
            revertTitleSpan.className = "task-title";
            revertTitleSpan.textContent = originalTitle;
            titleInput.parentNode.replaceChild(revertTitleSpan, titleInput);

            const revertDueSpan = document.createElement('span');
            revertDueSpan.className = "task-due";
            revertDueSpan.textContent = originalDueDate;
            dueInput.parentNode.replaceChild(revertDueSpan, dueInput);

            statusSelect.value = originalStatus;
            statusSelect.disabled = true;
            editBtn.style.display = "";
            saveBtn.style.display = "none";
            cancelBtn.style.display = "none";
            editing = false;
        });

        // File upload for evidence
        const fileInput = row.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                try {
                    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
                        method: "POST",
                        body: formData
                    });
                    const data = await res.json();
                    if (data.secure_url) {
                        const updates = { evidenceUrl: data.secure_url };
                        await syncTaskWithAdminAndEmployee(taskId, task.assignToId, updates);
                        alert("Evidence uploaded!");
                    } else {
                        alert("Cloudinary upload failed.");
                    }
                } catch (err) {
                    alert("Failed to upload evidence: " + err.message);
                }
            });
        }

        tableBody.appendChild(row);
    }
}

// --- Completed Tasks Table (ADMIN FIXED) ---
const completedTasksNav = document.querySelector('a[onclick="showSection(\'completedTasks\')"]');
if (completedTasksNav) completedTasksNav.addEventListener('click', subscribeAndRenderCompletedTasks);

let unsubscribeCompletedTasksListener = null;
function subscribeAndRenderCompletedTasks() {
    // Use adminUid so we always get all admin-assigned tasks (including completed)
    if (unsubscribeCompletedTasksListener) unsubscribeCompletedTasksListener();
    unsubscribeCompletedTasksListener = onSnapshot(
        collection(db, "users", adminUid, "tasks"),
        snapshot => {
            const completed = snapshot.docs.filter(doc => doc.data().status === "Done");
            renderCompletedTasksTable(completed);
        }
    );
}

async function renderCompletedTasksTable(taskDocs) {
    const tableBody = document.getElementById('completed-tasks-table-body');
    tableBody.innerHTML = "";
    const employeesSnap = await getDocs(collection(db, "Admin", adminUid, "employee"));
    const employees = new Map();
    employeesSnap.forEach(doc => {
        const emp = doc.data();
        if (emp.uid && !employees.has(emp.uid)) {
            employees.set(emp.uid, `${emp.username || ""} ${emp.lastname || ""} (${emp.email || ""})`);
        }
    });

    for (const docSnap of taskDocs) {
        const task = docSnap.data();
        const taskId = docSnap.id;
        if (task.status !== "Done") continue;
        const assignedName = employees.get(task.assignToId) || "Unknown";
        let evidenceCell = task.evidenceUrl
            ? `<a href="${task.evidenceUrl}" target="_blank" rel="noopener noreferrer" class="evidence-link">View Evidence</a>`
            : "";
        const showDate = task.doneDate ? task.doneDate : formatDateTime(task.dueDate);

        // Show status and action column in completed tasks as in your HTML
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title || ""}</td>
            <td>${assignedName}</td>
            <td>${showDate}</td>
            <td>
                <select data-edit-status data-taskid="${taskId}" disabled>
                    <option value="Unfinished"${task.status === "Unfinished" ? " selected" : ""}>Unfinished</option>
                    <option value="Done"${task.status === "Done" ? " selected" : ""}>Done</option>
                </select>
            </td>
            <td>${evidenceCell}</td>
            <td>
                <button class="edit-btn primary-btn" data-taskid="${taskId}">Edit</button>
                <button class="save-btn primary-btn" data-taskid="${taskId}" style="display:none;">Save</button>
                <button class="cancel-btn" data-taskid="${taskId}" style="display:none;">Cancel</button>
            </td>
        `;

        let editing = false;
        const editBtn = row.querySelector('.edit-btn');
        const saveBtn = row.querySelector('.save-btn');
        const cancelBtn = row.querySelector('.cancel-btn');
        const statusSelect = row.querySelector('select[data-edit-status]');
        let originalStatus = task.status;

        editBtn.addEventListener('click', () => {
            if (editing) return;
            editing = true;
            statusSelect.disabled = false;
            editBtn.style.display = "none";
            saveBtn.style.display = "";
            cancelBtn.style.display = "";
        });

        saveBtn.addEventListener('click', async () => {
            const newStatus = statusSelect.value;
            const updates = {
                status: newStatus,
                doneDate: newStatus === "Done" ? formatDateTime(new Date()) : ""
            };
            await syncTaskWithAdminAndEmployee(taskId, task.assignToId, updates);

            originalStatus = newStatus;
            statusSelect.disabled = true;
            editBtn.style.display = "";
            saveBtn.style.display = "none";
            cancelBtn.style.display = "none";
            editing = false;
        });

        cancelBtn.addEventListener('click', () => {
            statusSelect.value = originalStatus;
            statusSelect.disabled = true;
            editBtn.style.display = "";
            saveBtn.style.display = "none";
            cancelBtn.style.display = "none";
            editing = false;
        });

        tableBody.appendChild(row);
    }
}

// --- Logout ---
export function logout() {
    signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = "index.html";
    });
}
window.logout = logout;
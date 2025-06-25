import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getFirestore, collection, updateDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js";

// --- Cloudinary ---
const CLOUDINARY_UPLOAD_URL = "https://api.cloudinary.com/v1_1/djkjh7x7q/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "track_task";

// --- Firebase ---
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

const adminUid = "1WrUyeslVQamX5nk7DTqrB2padS2";

export function logout() {
    signOut(auth).then(() => {
        localStorage.clear();
        window.location.href = "index.html";
    });
}
window.logout = logout;

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

// --- Always update both employee & admin copies ---
async function syncTaskWithAdminAndEmployee(taskId, assignToId, updates) {
    // assignToId is always the task owner (employee)
    const adminRef = doc(db, "users", adminUid, "tasks", taskId);
    const empRef = doc(db, "users", assignToId, "tasks", taskId);
    try { await updateDoc(adminRef, updates); } catch (err) {}
    try { await updateDoc(empRef, updates); } catch (err) {}
}

// --- Render "My Tasks" ---
function subscribeAndRenderEmployeeTasks() {
    auth.onAuthStateChanged(user => {
        if (!user) return;
        const uid = user.uid;
        onSnapshot(collection(db, "users", uid, "tasks"), (tasksSnap) => {
            const tasks = [];
            tasksSnap.forEach(taskDoc => {
                tasks.push({ ...taskDoc.data(), taskId: taskDoc.id });
            });
            renderEmployeeTasks(tasks, user);
            renderEmployeeCompletedTasks(tasks, user);
        });
    });
}

function renderEmployeeTasks(tasks, user) {
    const tbody = document.getElementById('employee-tasks-table-body');
    tbody.innerHTML = "";
    // FIX: Only show unfinished tasks assigned to this employee
    tasks.filter(t => t.status !== "Done" && t.assignToId === user.uid).forEach(task => {
        const row = document.createElement('tr');
        let evidenceCell = "";
        if (task.evidenceUrl) {
            evidenceCell = `<a href="${task.evidenceUrl}" target="_blank" rel="noopener noreferrer" class="evidence-link">View Evidence</a>`;
        } else {
            evidenceCell = `<input type="file" accept="image/*,.pdf" data-taskid="${task.taskId}">`;
        }
        row.innerHTML = `
            <td>${task.title || ""}</td>
            <td>${task.description || ""}</td>
            <td>${formatDateTime(task.dueDate)}</td>
            <td>
                <select data-edit-status data-taskid="${task.taskId}" disabled>
                    <option value="Unfinished"${task.status === "Unfinished" ? " selected" : ""}>Unfinished</option>
                    <option value="Done"${task.status === "Done" ? " selected" : ""}>Done</option>
                </select>
            </td>
            <td>${evidenceCell}</td>
            <td>
                <button class="edit-btn primary-btn" data-taskid="${task.taskId}">Edit</button>
            </td>
        `;
        const temp = document.createElement('tbody');
        temp.appendChild(row);

        // Evidence upload
        const fileInput = temp.querySelector('input[type="file"]');
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
                        // Always use task.assignToId for the employee UID
                        await syncTaskWithAdminAndEmployee(fileInput.dataset.taskid, task.assignToId, updates);
                        alert("Evidence uploaded!");
                    } else {
                        alert("Cloudinary upload failed.");
                    }
                } catch (err) {
                    alert("Failed to upload evidence: " + err.message);
                }
            });
        }

        // Edit status
        const editBtn = temp.querySelector('.edit-btn');
        const statusSelect = temp.querySelector('select[data-edit-status]');
        let editing = false;
        if (editBtn && statusSelect) {
            editBtn.addEventListener('click', async () => {
                if (!editing) {
                    statusSelect.disabled = false;
                    editBtn.textContent = "Save";
                    editing = true;
                } else {
                    statusSelect.disabled = true;
                    editBtn.textContent = "Edit";
                    editing = false;
                    const newStatus = statusSelect.value;
                    let updates = {
                        status: newStatus,
                        doneDate: newStatus === "Done" ? formatDateTime(new Date()) : ""
                    };
                    // Always use task.assignToId for the employee UID
                    await syncTaskWithAdminAndEmployee(editBtn.dataset.taskid, task.assignToId, updates);
                    alert("Task status updated!");
                }
            });
        }
        tbody.appendChild(row);
    });
}

function renderEmployeeCompletedTasks(tasks, user) {
    const tbody = document.getElementById('employee-completed-tasks-table-body');
    tbody.innerHTML = "";
    // FIX: Only show completed tasks assigned to this employee
    tasks.filter(t => t.status === "Done" && t.assignToId === user.uid).forEach(task => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${task.title || ""}</td>
            <td>${task.description || ""}</td>
            <td>${task.doneDate ? task.doneDate : ""}</td>
            <td>${task.evidenceUrl ? `<a href="${task.evidenceUrl}" target="_blank">View Evidence</a>` : ""}</td>
        `;
        tbody.appendChild(row);
    });
}

// On load
subscribeAndRenderEmployeeTasks();
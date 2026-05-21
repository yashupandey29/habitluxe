const API_URL = '/api';

let currentUser = null;
let habits = [];

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        fetchProfile();
    }
    setGreeting();
});

// Set greeting based on time
function setGreeting() {
    const hour = new Date().getHours();
    let greeting = 'Morning';
    if (hour >= 12 && hour < 17) greeting = 'Afternoon';
    else if (hour >= 17) greeting = 'Evening';
    document.getElementById('greeting').textContent = greeting;

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', options);
}

// Auth Functions
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

// Register
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showDashboard();
            showToast('Welcome to Habitluxe!', 'success');
        } else {
            showToast(data.message || 'Registration failed', 'error');
        }
    } catch (err) {
        showToast('Cannot connect to server', 'error');
    }
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            showDashboard();
            showToast(`Welcome back, ${data.user.name}!`, 'success');
        } else {
            showToast(data.message || 'Invalid credentials', 'error');
        }
    } catch (err) {
        showToast('Cannot connect to server', 'error');
    }
});

// Fetch Profile
async function fetchProfile() {
    try {
        const res = await fetch(`${API_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            showDashboard();
        } else {
            logout();
        }
    } catch (err) {
        // Offline mode - use localStorage
    }
}

// Show Dashboard
function showDashboard() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('heroName').textContent = currentUser.name.split(' ')[0];
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

    if (currentUser.role === 'admin') {
        document.getElementById('adminLink').style.display = 'block';
    }

    loadHabits();
    loadStats();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

// Load Habits
async function loadHabits() {
    try {
        const res = await fetch(`${API_URL}/habits`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        habits = await res.json();
        renderHabits();
    } catch (err) {
        // Use local data
        habits = [];
        renderHabits();
    }
}

// Render Habits
function renderHabits() {
    const list = document.getElementById('habitList');
    list.innerHTML = '';

    const todayHabits = habits;
    let completed = 0;

    todayHabits.forEach((habit, index) => {
        if (habit.completed) completed++;

        const li = document.createElement('li');
        li.className = `habit-item ${habit.completed ? 'completed' : ''}`;
        li.innerHTML = `
      <div class="habit-left">
        <input type="checkbox" class="habit-checkbox" ${habit.completed ? 'checked' : ''} 
          onchange="toggleHabit('${habit._id}')">
        <div>
          <div class="habit-name">${habit.name}</div>
          ${habit.reminderTime ? `<div class="habit-reminder">⏰ ${habit.reminderTime}</div>` : ''}
        </div>
      </div>
      <button class="habit-delete" onclick="deleteHabit('${habit._id}')">✕</button>
    `;
        list.appendChild(li);
    });

    document.getElementById('habitsCount').textContent = `${completed}/${todayHabits.length}`;
    document.getElementById('completedCount').textContent = completed;
}

// Add Habit
async function addHabit() {
    const name = document.getElementById('newHabitName').value;
    const reminderTime = document.getElementById('habitReminder').value;

    if (!name) {
        showToast('Please enter a habit name', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/habits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ name, reminderTime })
        });

        if (res.ok) {
            document.getElementById('newHabitName').value = '';
            document.getElementById('habitReminder').value = '';
            loadHabits();
            showToast('Habit added!', 'success');
        }
    } catch (err) {
        showToast('Failed to add habit', 'error');
    }
}

// Toggle Habit
async function toggleHabit(id) {
    try {
        const res = await fetch(`${API_URL}/habits/${id}/toggle`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            loadHabits();
        }
    } catch (err) {
        showToast('Failed to update habit', 'error');
    }
}

// Delete Habit
async function deleteHabit(id) {
    try {
        const res = await fetch(`${API_URL}/habits/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });

        if (res.ok) {
            loadHabits();
            showToast('Habit deleted', 'success');
        }
    } catch (err) {
        showToast('Failed to delete habit', 'error');
    }
}

// Load Stats
async function loadStats() {
    try {
        const res = await fetch(`${API_URL}/stats`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        document.getElementById('completionRate').textContent = `${data.percentage}%`;
        document.getElementById('streakCount').textContent = currentUser.streak || 0;
    } catch (err) {
        // Use defaults
    }

    loadSleepStats();
}

// Save Sleep
async function saveSleep() {
    const sleepTime = document.getElementById('sleepTime').value;
    const wakeTime = document.getElementById('wakeTime').value;

    if (!sleepTime || !wakeTime) {
        showToast('Please enter both times', 'error');
        return;
    }

    try {
        const res = await fetch(`${API_URL}/sleep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ sleepTime, wakeTime })
        });

        if (res.ok) {
            document.getElementById('sleepTime').value = '';
            document.getElementById('wakeTime').value = '';
            loadSleepStats();
            showToast('Sleep data saved!', 'success');
        }
    } catch (err) {
        showToast('Failed to save sleep data', 'error');
    }
}

// Load Sleep Stats
async function loadSleepStats() {
    try {
        const res = await fetch(`${API_URL}/sleep`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();

        const container = document.getElementById('sleepStats');
        container.innerHTML = '';

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const sleepData = data.slice(-7).reverse();

        sleepData.forEach(sleep => {
            const date = new Date(sleep.createdAt || Date.now());
            const dayName = days[date.getDay()];

            const div = document.createElement('div');
            div.className = 'sleep-day';
            div.innerHTML = `
        <div class="sleep-day-label">${dayName}</div>
        <div class="sleep-time">${sleep.sleepTime}</div>
      `;
            container.appendChild(div);
        });

        if (sleepData.length > 0) {
            document.getElementById('avgSleep').textContent = sleepData[0].sleepTime;
        }
    } catch (err) {
        // Use defaults
    }
}

// Admin Functions
async function loadAdminData() {
    try {
        const res = await fetch(`${API_URL}/admin/users`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const users = await res.json();

        const container = document.getElementById('adminUsers');
        container.innerHTML = '';

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'admin-user';
            div.innerHTML = `
        <div class="admin-user-info">
          <div class="admin-avatar">${user.name.charAt(0)}</div>
          <div>
            <div class="admin-name">${user.name}</div>
            <div class="admin-email">${user.email}</div>
          </div>
        </div>
        <span class="admin-role ${user.role}">${user.role}</span>
      `;
            container.appendChild(div);
        });

        showToast('Admin data loaded', 'success');
    } catch (err) {
        showToast('Access denied', 'error');
    }
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
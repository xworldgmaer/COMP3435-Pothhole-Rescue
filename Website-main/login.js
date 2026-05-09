// ── Default demo accounts ─────────────────────────────────────────────
const DEFAULT_USERS = [
    { username: 'admin',    password: 'Admin123!',       role: 'Administrator' },
    { username: 'gov',      password: 'Government123!',  role: 'Government'    },
    { username: 'itstaff',  password: 'ITStaff123!',     role: 'IT Staff'      },
    { username: 'customer', password: 'Customer123!',    role: 'Customer'      },
    { username: 'minister', password: 'Minister123!',    role: 'Government'    },
];

function seedDefaultUsers() {
    const stored = JSON.parse(localStorage.getItem('loginData') || '[]');
    const merged = [...stored];
    DEFAULT_USERS.forEach(d => {
        if (!stored.some(u => u.username === d.username)) merged.push(d);
    });
    localStorage.setItem('loginData', JSON.stringify(merged));
}

// ── Remember me ───────────────────────────────────────────────────────
function loadRemembered() {
    const saved = JSON.parse(localStorage.getItem('prRemember') || 'null');
    if (!saved) return;
    const uEl = document.getElementById('username');
    const rEl = document.getElementById('rememberMe');
    if (uEl) uEl.value = saved.username || '';
    if (rEl) rEl.checked = true;
    // Pre-select the matching role tab
    if (saved.role) {
        const tab = document.querySelector(`.roleTab[data-role="${saved.role}"]`);
        if (tab) {
            document.querySelectorAll('.roleTab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
            tab.classList.add('active'); tab.setAttribute('aria-pressed','true');
        }
    }
}

function saveRemembered(username, role) {
    const rEl = document.getElementById('rememberMe');
    if (rEl && rEl.checked) {
        localStorage.setItem('prRemember', JSON.stringify({ username, role }));
    } else {
        localStorage.removeItem('prRemember');
    }
}

// ── Social login (demo — no real OAuth) ──────────────────────────────
function socialLogin(provider) {
    const username = provider === 'Facebook' ? 'facebook.user' : 'google.user';
    const role     = 'Customer';
    sessionStorage.setItem('loggedInUser', username);
    sessionStorage.setItem('loggedInRole', role);
    saveRemembered(username, role);
    showLoginToast(`Welcome, ${provider} user! Redirecting…`, 'success');
    setTimeout(() => window.location.href = 'index.html', 1000);
}

// ── Toast helper ──────────────────────────────────────────────────────
function showLoginToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent  = msg;
    t.className    = 'toast toast-' + type;
    t.hidden       = false;
    setTimeout(() => { t.hidden = true; }, 4500);
}

// ── Form submit ───────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const statusEl = document.getElementById('status');

    if (!username || !password) {
        statusEl.textContent = '⚠ Please enter your username and password.';
        statusEl.className   = 'statusMsg status-error';
        return;
    }

    // Loading state
    document.getElementById('btnText').textContent    = 'Signing in…';
    document.getElementById('btnSpinner').hidden      = false;
    statusEl.textContent = '';

    setTimeout(() => {
        document.getElementById('btnText').textContent = 'Login';
        document.getElementById('btnSpinner').hidden   = true;

        const users = JSON.parse(localStorage.getItem('loginData') || '[]');
        const user  = users.find(u => u.username === username);

        if (!user) {
            statusEl.textContent = '❌ Username not found.';
            statusEl.className   = 'statusMsg status-error';
            return;
        }
        if (user.password !== password) {
            statusEl.textContent = '❌ Incorrect password.';
            statusEl.className   = 'statusMsg status-error';
            return;
        }

        sessionStorage.setItem('loggedInUser', username);
        sessionStorage.setItem('loggedInRole', user.role || 'Customer');
        saveRemembered(username, user.role || 'Customer');

        statusEl.textContent = `✅ Welcome, ${username}! Redirecting…`;
        statusEl.className   = 'statusMsg status-success';

        setTimeout(() => window.location.href = 'index.html', 900);
    }, 700);
});

// ── Particles config ──────────────────────────────────────────────────
function initParticles() {
    if (typeof particlesJS === 'undefined') {
        console.warn('particles.js not loaded');
        return;
    }
    particlesJS('particles-js', {
        particles: {
            number:      { value: 90, density: { enable: true, value_area: 900 } },
            color:       { value: ['#ffffff', '#ffcc00', '#162DB0', '#4285F4'] },
            shape:       { type: 'circle' },
            opacity:     { value: 0.55, random: true,
                           anim: { enable: true, speed: 0.8, opacity_min: 0.15, sync: false } },
            size:        { value: 4, random: true,
                           anim: { enable: true, speed: 3, size_min: 0.5, sync: false } },
            line_linked: { enable: true, distance: 140, color: '#ffffff', opacity: 0.25, width: 1 },
            move: {
                enable: true, speed: 2.5, direction: 'none',
                random: true, straight: false, out_mode: 'out',
                attract: { enable: false }
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true,  mode: 'grab'  },
                onclick: { enable: true,  mode: 'push'  },
                resize:  true
            },
            modes: {
                grab:    { distance: 160, line_linked: { opacity: 0.6 } },
                push:    { particles_nb: 3 },
                repulse: { distance: 120 }
            }
        },
        retina_detect: true
    });
}

// ── Boot ──────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    seedDefaultUsers();
    loadRemembered();
    initParticles();
});
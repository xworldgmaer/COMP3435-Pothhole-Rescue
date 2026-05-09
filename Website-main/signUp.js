function validatePassword(pw) {
    return pw.length >= 6 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

document.getElementById('signupForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const confirm  = document.getElementById('confirmPassword').value;
    const role     = document.querySelector('.roleTab.active')?.dataset.role || 'Customer';
    const statusEl = document.getElementById('signupStatus');

    if (!username || !password || !confirm) {
        statusEl.textContent = '⚠ Please fill all fields.';
        statusEl.className   = 'statusMsg status-error';
        return;
    }
    if (password !== confirm) {
        statusEl.textContent = '❌ Passwords do not match.';
        statusEl.className   = 'statusMsg status-error';
        return;
    }
    if (!validatePassword(password)) {
        statusEl.textContent = '❌ Password needs 6+ characters, a letter, number and special character.';
        statusEl.className   = 'statusMsg status-error';
        return;
    }

    const users = JSON.parse(localStorage.getItem('loginData') || '[]');
    if (users.some(u => u.username === username)) {
        statusEl.textContent = '❌ Username already taken. Please choose another.';
        statusEl.className   = 'statusMsg status-error';
        return;
    }

    users.push({ username, password, role });
    localStorage.setItem('loginData', JSON.stringify(users));

    statusEl.textContent = `✅ Account created as ${role}. Redirecting to login…`;
    statusEl.className   = 'statusMsg status-success';
    this.reset();
    setTimeout(() => window.location.href = 'login.html', 1400);
});

// ── Particles (same config as login) ─────────────────────────────────
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

window.addEventListener('DOMContentLoaded', initParticles);
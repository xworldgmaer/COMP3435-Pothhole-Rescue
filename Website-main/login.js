const form = document.getElementById('loginForm');
const status = document.getElementById('status');

form.addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        status.textContent = 'Enter username and password.';
        status.style.color = 'red';
        return;
    }

    const users = JSON.parse(localStorage.getItem('loginData') || '[]');
    const user = users.find(u => u.username === username);

    if (!user) {
        status.textContent = 'Username not found.';
        status.style.color = 'red';
        return;
    }

    if (user.password !== password) {
        status.textContent = 'Wrong password.';
        status.style.color = 'red';
        return;
    }

    status.textContent = `Welcome, ${username}! Login successful.`;
    status.style.color = 'green';
    form.reset();
    setTimeout(() => {
        sessionStorage.setItem('loggedInUser', username);
        window.location.href = 'index.html';
    }, 1000);
});


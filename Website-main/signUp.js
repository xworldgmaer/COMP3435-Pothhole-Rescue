const signupForm = document.getElementById('signupForm');
const signupStatus = document.getElementById('signupStatus');

function validatePassword(password) {
    const minLen = 6;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
    return password.length >= minLen && hasLetter && hasNumber && hasSpecial;
}

signupForm.addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!username || !password || !confirmPassword) {
        signupStatus.textContent = 'Fill all fields.';
        signupStatus.style.color = 'red';
        return;
    }

    if (password !== confirmPassword) {
        signupStatus.textContent = 'Passwords do not match.';
        signupStatus.style.color = 'red';
        return;
    }

    if (!validatePassword(password)) {
        signupStatus.textContent = 'Use 6+ chars, letter, number and special char.';
        signupStatus.style.color = 'red';
        return;
    }

    const users = JSON.parse(localStorage.getItem('loginData') || '[]');
    if (users.some(u => u.username === username)) {
        signupStatus.textContent = 'Username already exists.';
        signupStatus.style.color = 'red';
        return;
    }

    users.push({ username, password });
    localStorage.setItem('loginData', JSON.stringify(users));

    signupStatus.textContent = 'Account created. Please login.';
    signupStatus.style.color = 'green';
    signupForm.reset();
});
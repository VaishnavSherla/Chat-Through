// Login
if (document.querySelector('.form')) {
    document.querySelector('.form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };

        try {
            const res = await axios.post('/login', formData);

            if (res.data.status === 'fail') {
                toastr.error(res.data.message, 'Error');
            } else if (res.data.status === 'success') {
                toastr.success(res.data.message, 'Success');
                localStorage.setItem('jwt', res.data.token);
                localStorage.setItem('user', res.data.username);
                setTimeout(() => {
                    document.querySelector(".loader").style.display = "none";
                    document.querySelector(".loader_bg").style.display = "none";
                    location.assign('/');
                }, 1500);
            }
        } catch (err) {
            document.querySelector(".loader").style.display = "none";
            document.querySelector(".loader_bg").style.display = "none";
            let text = "";
            const error = err.response.data.message;
            const errors = error.replace('User validation failed:', '').split(',');
            errors.forEach(item => {
                text += `<div class="alert alert-danger alert-dismissible fade show" role="alert">${item}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>`;
            });
            document.querySelector(".error_message").innerHTML = text;
        } finally {
            document.querySelector(".loader").style.display = "none";
            document.querySelector(".loader_bg").style.display = "none";
        }
    });
}

// Register
if (document.querySelector('.form--signup')) {
    document.querySelector('.form--signup').addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };

        try {
            const res = await axios.post('/register', formData);

            if (res.data.status === 'fail') {
                toastr.error(res.data.message, 'Error');
            } else if (res.data.status === 'success') {
                toastr.success(res.data.message, 'Success');
                localStorage.setItem('jwt', res.data.token);
                localStorage.setItem('user', res.data.username);
                setTimeout(() => {
                    document.querySelector(".loader").style.display = "none";
                    document.querySelector(".loader_bg").style.display = "none";
                    location.assign('/');
                }, 1500);
            }
        } catch (err) {
            document.querySelector(".loader").style.display = "none";
            document.querySelector(".loader_bg").style.display = "none";
            let text = "";
            const error = err.response.data.message;
            const errors = error.replace('User validation failed:', '').split(',');
            errors.forEach(item => {
                text += `<div class="alert alert-danger alert-dismissible fade show" role="alert">${item}
                            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                        </div>`;
            });
            document.querySelector(".error_message").innerHTML = text;
        }
    });
}

// Logout
if (document.querySelector('.nav-logout')) {
    document.querySelector('.nav-logout').addEventListener('click', async () => {
        try {
            await axios.get('/logout');
            localStorage.removeItem('jwt');
            localStorage.removeItem('user');
            location.assign('/login');
        } catch (err) {
            console.error('Logout error:', err);
        }
    });
}

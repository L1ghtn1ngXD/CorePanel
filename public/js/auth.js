const formTitle = document.getElementById("form-title");
const authForm = document.getElementById("auth-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("submit-button");
const messageElement = document.getElementById("message");

let currentMode = "login";

function showMessage(message, type = "error") {
    messageElement.textContent = message;
    messageElement.classList.toggle("success", type === "success");
}

function setLoading(loading) {
    usernameInput.disabled = loading;
    passwordInput.disabled = loading;
    submitButton.disabled = loading;
}

function configureForm(registered) {
    currentMode = registered ? "login" : "register";

    if (currentMode === "register") {
        formTitle.textContent = "Registration";
        submitButton.textContent = "Create account";
        passwordInput.autocomplete = "new-password";
        return;
    }

    formTitle.textContent = "Login";
    submitButton.textContent = "Login";
    passwordInput.autocomplete = "current-password";
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, options);

    let data;

    try {
        data = await response.json();
    } catch {
        data = {
            success: false,
            message: "The server returned an invalid response."
        };
    }

    if (!response.ok) {
        throw new Error(data.message || "Request failed.");
    }

    return data;
}

async function loadAuthenticationStatus() {
    setLoading(true);

    try {
        const status = await requestJson("/api/auth/status");

        if (status.authenticated) {
            window.location.replace("/panel");
            return;
        }

        configureForm(status.registered);
        usernameInput.focus();
    } catch (error) {
        formTitle.textContent = "Unavailable";
        showMessage(error.message);
    } finally {
        setLoading(false);
    }
}

authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage("");
    setLoading(true);

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    const endpoint =
        currentMode === "register"
            ? "/api/auth/register"
            : "/api/auth/login";

    try {
        await requestJson(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        if (currentMode === "register") {
            showMessage(
                "Account created. You can now log in.",
                "success"
            );

            passwordInput.value = "";
            configureForm(true);
            passwordInput.focus();
            return;
        }

        window.location.replace("/panel");
    } catch (error) {
        showMessage(error.message);
        passwordInput.select();
    } finally {
        setLoading(false);
    }
});

loadAuthenticationStatus();

const loginForm =
    document.getElementById("loginForm");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");


loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const userId =
        document.getElementById("user_id").value;

    const password =
        document.getElementById("password").value;


    if (!userId || !password) {

        showMessage(
            "Please enter your User ID and password.",
            "error"
        );

        return;
    }


    loginButton.disabled = true;

    loginButton.textContent = "Logging in...";


    try {

        const response = await fetch(
            "http://localhost:8000/login",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    user_id: Number(userId),
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail || "Invalid User ID or password."
            );
        }


        /*
         * Store authentication information.
         *
         * If your backend returns a JWT token,
         * this will store it for the dashboard.
         */

        if (data.access_token) {

            localStorage.setItem(
                "access_token",
                data.access_token
            );
        }


        localStorage.setItem(
            "user_id",
            userId
        );


        if (data.user) {

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );
        }


        showMessage(
            "Login successful. Redirecting...",
            "success"
        );


        setTimeout(() => {

            window.location.href =
                "../frontend/dashboard.html";

        }, 700);


    } catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Unable to connect to the server.",
            "error"
        );

    } finally {

        loginButton.disabled = false;

        loginButton.textContent = "Login";
    }

});


function showMessage(text, type) {

    loginMessage.textContent = text;

    loginMessage.className =
        "message " + type;
}

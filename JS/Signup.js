
const signupForm = document.getElementById("signupForm");

const locationButton =
    document.getElementById("locationButton");

const locationStatus =
    document.getElementById("locationStatus");

const latitudeDisplay =
    document.getElementById("latitude");

const longitudeDisplay =
    document.getElementById("longitude");

const message =
    document.getElementById("message");

const signupButton =
    document.getElementById("signupButton");


let latitude = null;
let longitude = null;


/* =========================
   GET USER LOCATION
========================= */

locationButton.addEventListener("click", () => {

    if (!navigator.geolocation) {

        locationStatus.textContent =
            "Geolocation is not supported by your browser.";

        return;
    }

    locationStatus.textContent =
        "Detecting your location...";

    locationButton.disabled = true;

    navigator.geolocation.getCurrentPosition(

        function(position) {

            latitude =
                position.coords.latitude;

            longitude =
                position.coords.longitude;


            latitudeDisplay.textContent =
                latitude.toFixed(6);

            longitudeDisplay.textContent =
                longitude.toFixed(6);


            locationStatus.textContent =
                "✓ Location detected";


            locationButton.textContent =
                "Location Detected";

            locationButton.disabled = false;

        },

        function(error) {

            locationButton.disabled = false;

            switch (error.code) {

                case error.PERMISSION_DENIED:

                    locationStatus.textContent =
                        "Location permission denied.";

                    break;


                case error.POSITION_UNAVAILABLE:

                    locationStatus.textContent =
                        "Location information unavailable.";

                    break;


                case error.TIMEOUT:

                    locationStatus.textContent =
                        "Location request timed out.";

                    break;


                default:

                    locationStatus.textContent =
                        "Unable to detect location.";
            }

        },

        {
            enableHighAccuracy: true,

            timeout: 10000,

            maximumAge: 0
        }
    );

});


/* =========================
   FORM SUBMISSION
========================= */

signupForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    /* Check location */

    if (latitude === null || longitude === null) {

        showMessage(
            "Please detect your location before signing up.",
            "error"
        );

        return;
    }


    /* Get form values */

    const userId =
        document.getElementById("user_id").value;

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const role =
        document.getElementById("role").value;


    /* Basic validation */

    if (password.length < 6) {

        showMessage(
            "Password must contain at least 6 characters.",
            "error"
        );

        return;
    }


    /* Data sent to FastAPI */

    const userData = {

        user_id: Number(userId),

        name: name,

        email: email,

        password: password,

        role: role,

        latitude: latitude,

        longitude: longitude
    };


    try {

        signupButton.disabled = true;

        signupButton.textContent =
            "Creating Account...";


        /*
         * FastAPI endpoint
         *
         * Change this URL if your backend
         * runs somewhere else.
         */

        const response = await fetch(
            "http://localhost:8000/signup",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(userData)
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.detail || "Signup failed."
            );
        }


        /* Success */

        showMessage(
            "Account created successfully!",
            "success"
        );


        signupForm.reset();


        latitude = null;
        longitude = null;


        latitudeDisplay.textContent = "—";
        longitudeDisplay.textContent = "—";

        locationStatus.textContent =
            "Location not detected";


        locationButton.textContent =
            "Detect My Location";


    } catch (error) {

        console.error(error);

        showMessage(
            error.message ||
            "Unable to connect to the server.",
            "error"
        );

    } finally {

        signupButton.disabled = false;

        signupButton.textContent =
            "Create Account";
    }

});


/* =========================
   MESSAGE FUNCTION
========================= */

function showMessage(text, type) {

    message.textContent = text;

    message.className =
        "message " + type;
}
